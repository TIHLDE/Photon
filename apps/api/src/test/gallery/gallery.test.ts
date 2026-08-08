import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const image = (name: string) =>
    `https://leptonstoragepro.blob.core.windows.net/imagejpeg/${name}.jpg`;

describe("Gallery System", () => {
    integrationTest(
        "Complete gallery lifecycle: create, list, pictures, paginate, delete",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            const regularUser = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, ["galleries:manage"]);

            const adminClient = await ctx.utils.clientForUser(admin);
            const userClient = await ctx.utils.clientForUser(regularUser);

            // === CREATE ===

            const createResponse = await adminClient.api.galleries.$post({
                json: {
                    title: "Vårgalla 2026",
                    description: "Her er bildene fra årets vårgalla!",
                },
            });

            expect(createResponse.status).toBe(201);
            const album = await createResponse.json();
            // Norwegian letters are transliterated, not stripped.
            expect(album.slug).toBe("vaargalla-2026");
            expect(album.pictureCount).toBe(0);

            // Members without the permission cannot create albums.
            const forbiddenResponse = await userClient.api.galleries.$post({
                json: { title: "Uautorisert galleri" },
            });
            expect(forbiddenResponse.status).toBe(403);

            // Same title again gets a distinct slug instead of failing.
            const duplicateResponse = await adminClient.api.galleries.$post({
                json: { title: "Vårgalla 2026" },
            });
            expect(duplicateResponse.status).toBe(201);
            expect((await duplicateResponse.json()).slug).toBe(
                "vaargalla-2026-2",
            );

            // === PICTURES ===

            const addResponse = await adminClient.api.galleries[
                ":slug"
            ].pictures.$post({
                param: { slug: album.slug },
                json: {
                    pictures: Array.from({ length: 30 }, (_, i) => ({
                        imageUrl: image(`picture-${i}`),
                    })),
                },
            });

            expect(addResponse.status).toBe(201);
            expect((await addResponse.json()).created).toBe(30);

            // Members cannot add pictures.
            const forbiddenPicturesResponse = await userClient.api.galleries[
                ":slug"
            ].pictures.$post({
                param: { slug: album.slug },
                json: { pictures: [{ imageUrl: image("nope") }] },
            });
            expect(forbiddenPicturesResponse.status).toBe(403);

            // === PAGINATION (this is what "Last inn mer" walks) ===

            const firstPage = await adminClient.api.galleries[
                ":slug"
            ].pictures.$get({
                param: { slug: album.slug },
                query: { page: "0", pageSize: "25" },
            });

            expect(firstPage.status).toBe(200);
            const firstPageBody = await firstPage.json();
            expect(firstPageBody.totalCount).toBe(30);
            expect(firstPageBody.items).toHaveLength(25);
            expect(firstPageBody.nextPage).toBe(1);

            const secondPage = await adminClient.api.galleries[
                ":slug"
            ].pictures.$get({
                param: { slug: album.slug },
                query: { page: "1", pageSize: "25" },
            });

            const secondPageBody = await secondPage.json();
            expect(secondPageBody.items).toHaveLength(5);
            // The last page must report no next page, or the button never hides.
            expect(secondPageBody.nextPage).toBeNull();

            // Pages must not overlap.
            const firstIds = new Set(firstPageBody.items.map((p) => p.id));
            expect(secondPageBody.items.some((p) => firstIds.has(p.id))).toBe(
                false,
            );

            // === LIST ===

            const listResponse = await adminClient.api.galleries.$get({
                query: { page: "0", pageSize: "25" },
            });
            const list = await listResponse.json();
            const listed = list.items.find((a) => a.slug === album.slug);

            expect(listed?.pictureCount).toBe(30);
            // The first uploaded picture becomes the cover automatically.
            expect(listed?.imageUrl).toBe(image("picture-0"));
            // Albums without pictures still report a count.
            expect(
                list.items.find((a) => a.slug === "vaargalla-2026-2")
                    ?.pictureCount,
            ).toBe(0);

            // === EVENT LINK ===

            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();

            const linkResponse = await adminClient.api.galleries[
                ":slug"
            ].$patch({
                param: { slug: album.slug },
                json: { eventId: event.id },
            });

            expect(linkResponse.status).toBe(200);
            expect((await linkResponse.json()).event?.id).toBe(event.id);

            // The link survives into the list view without an extra query.
            const listWithEvent = await adminClient.api.galleries.$get({
                query: { page: "0", pageSize: "25" },
            });
            // A Response body reads once, so hold onto the parsed payload.
            const listWithEventBody = await listWithEvent.json();
            expect(
                listWithEventBody.items.find((a) => a.slug === album.slug)
                    ?.event?.slug,
            ).toBe(event.slug);
            // Albums without an event report null, not a half-filled object.
            expect(
                listWithEventBody.items.find(
                    (a) => a.slug === "vaargalla-2026-2",
                )?.event,
            ).toBeNull();

            // Unlinking is possible.
            const unlinkResponse = await adminClient.api.galleries[
                ":slug"
            ].$patch({
                param: { slug: album.slug },
                json: { eventId: null },
            });
            expect((await unlinkResponse.json()).event).toBeNull();

            // === GET (members only, by slug) ===

            const getResponse = await userClient.api.galleries[":slug"].$get({
                param: { slug: album.slug },
            });
            expect(getResponse.status).toBe(200);
            expect((await getResponse.json()).pictureCount).toBe(30);

            const missingResponse = await userClient.api.galleries[
                ":slug"
            ].$get({
                param: { slug: "finnes-ikke" },
            });
            expect(missingResponse.status).toBe(404);

            // === DELETE ===

            const deletePictureResponse = await adminClient.api.galleries[
                ":slug"
            ].pictures[":pictureId"].$delete({
                param: {
                    slug: album.slug,
                    pictureId: firstPageBody.items[0]!.id,
                },
            });
            expect(deletePictureResponse.status).toBe(200);

            const afterPictureDelete = await adminClient.api.galleries[
                ":slug"
            ].$get({ param: { slug: album.slug } });
            expect((await afterPictureDelete.json()).pictureCount).toBe(29);

            const deleteAlbumResponse = await adminClient.api.galleries[
                ":slug"
            ].$delete({ param: { slug: album.slug } });
            expect(deleteAlbumResponse.status).toBe(200);

            // Deleting the album takes its pictures with it.
            const goneResponse = await userClient.api.galleries[":slug"].$get({
                param: { slug: album.slug },
            });
            expect(goneResponse.status).toBe(404);
        },
    );

    integrationTest(
        "the archive is for members: anonymous callers get 401",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["galleries:manage"]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const created = await adminClient.api.galleries.$post({
                json: { title: "Internt galleri" },
            });
            const album = await created.json();

            const anonymous = ctx.utils.client();

            const listResponse = await anonymous.api.galleries.$get({
                query: {},
            });
            expect(listResponse.status).toBe(401);

            const getResponse = await anonymous.api.galleries[":slug"].$get({
                param: { slug: album.slug },
            });
            expect(getResponse.status).toBe(401);

            const picturesResponse = await anonymous.api.galleries[
                ":slug"
            ].pictures.$get({
                param: { slug: album.slug },
                query: {},
            });
            expect(picturesResponse.status).toBe(401);
        },
    );
});
