import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import {
    createOngoingEvent,
    enableCamera,
    register,
    sessionCookie,
    submitPhotos,
    uploadPhoto,
} from "./helpers";

/** An event with one photographer who has taken and submitted `count` photos. */
async function eventWithPhotos(ctx: IntegrationTestContext, count: number) {
    const event = await createOngoingEvent(ctx);
    await enableCamera(ctx, event.id);

    const photographer = await ctx.utils.createTestUser();
    await register(ctx, event.id, photographer.id);
    const cookie = await sessionCookie(ctx, photographer);
    for (let i = 0; i < count; i++) {
        await uploadPhoto(ctx, cookie, event.id);
    }
    await submitPhotos(ctx, cookie, event.id);

    const organizer = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(organizer, ["events:update"]);

    return { event, photographer, organizer };
}

describe("wrapped photo selection", () => {
    integrationTest(
        "the organizer lists the photos, oldest first, with who took them",
        async ({ ctx }) => {
            const { event, photographer, organizer } = await eventWithPhotos(
                ctx,
                3,
            );
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.event[
                ":eventId"
            ].wrapped.photos.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({ totalCount: 3, selectedCount: 0 });
            expect(body.items).toHaveLength(3);
            expect(body.items[0]).toMatchObject({
                selected: false,
                uploadedBy: { id: photographer.id, name: photographer.name },
                imageUrl: `/api/event/${event.id}/wrapped/photos/${body.items[0]!.id}/image`,
            });
            expect(body.items.map((p) => p.createdAt)).toEqual(
                body.items.map((p) => p.createdAt).sort(),
            );
        },
        500_000,
    );

    integrationTest(
        "the organizer picks a photo and takes it out again",
        async ({ ctx }) => {
            const { event, organizer } = await eventWithPhotos(ctx, 2);
            const client = await ctx.utils.clientForUser(organizer);
            const photos = client.api.event[":eventId"].wrapped.photos;
            const [photo] = await ctx.db.query.wrappedPhoto.findMany();
            const param = { eventId: event.id, photoId: photo!.id };

            const picked = await photos[":photoId"].$patch({
                param,
                json: { selected: true },
            });

            expect(picked.status).toBe(200);
            expect(await picked.json()).toMatchObject({
                id: photo!.id,
                selected: true,
            });
            const list = await photos.$get({
                param: { eventId: event.id },
                query: {},
            });
            expect(await list.json()).toMatchObject({
                totalCount: 2,
                selectedCount: 1,
            });

            const unpicked = await photos[":photoId"].$patch({
                param,
                json: { selected: false },
            });

            expect(await unpicked.json()).toMatchObject({ selected: false });
            const stored = await ctx.db.query.wrappedPhoto.findFirst({
                where: eq(schema.wrappedPhoto.id, photo!.id),
            });
            expect(stored?.selectedAt).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "the organizer gets the image, and it is never cached",
        async ({ ctx }) => {
            const { event, organizer } = await eventWithPhotos(ctx, 1);
            const client = await ctx.utils.clientForUser(organizer);
            const [photo] = await ctx.db.query.wrappedPhoto.findMany();

            const response = await client.api.event[":eventId"].wrapped.photos[
                ":photoId"
            ].image.$get({
                param: { eventId: event.id, photoId: photo!.id },
                query: {},
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("image/png");
            expect(response.headers.get("Cache-Control")).toBe(
                "private, no-store",
            );
            expect(response.headers.get("X-Content-Type-Options")).toBe(
                "nosniff",
            );
            expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(
                0,
            );
        },
        500_000,
    );

    integrationTest(
        "the organizer gets a small version for the grid, and it is no more reachable than the photo",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id);
            const photographer = await ctx.utils.createTestUser();
            await register(ctx, event.id, photographer.id);
            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);

            // A real photo this time: the stand-in bytes cannot be resized.
            const sharp = (await import("sharp")).default;
            const content = await sharp({
                create: {
                    width: 2000,
                    height: 1500,
                    channels: 3,
                    background: { r: 20, g: 120, b: 200 },
                },
            })
                .png()
                .toBuffer();
            const cookie = await sessionCookie(ctx, photographer);
            await uploadPhoto(ctx, cookie, event.id, {
                type: "image/png",
                name: "fest.png",
                content,
            });
            await submitPhotos(ctx, cookie, event.id);
            const [photo] = await ctx.db.query.wrappedPhoto.findMany();
            const param = { eventId: event.id, photoId: photo!.id };

            const client = await ctx.utils.clientForUser(organizer);
            const image =
                client.api.event[":eventId"].wrapped.photos[":photoId"].image;

            const tile = await image.$get({ param, query: { w: "480" } });

            expect(tile.status).toBe(200);
            expect(tile.headers.get("Content-Type")).toBe("image/webp");
            expect(tile.headers.get("Cache-Control")).toBe("private, no-store");
            const meta = await sharp(
                Buffer.from(await tile.arrayBuffer()),
            ).metadata();
            expect(meta.width).toBe(480);
            expect(meta.height).toBe(360);

            // Only the two widths the selection view uses.
            const other = await ctx.app.request(
                `/api/event/${event.id}/wrapped/photos/${photo!.id}/image?w=320`,
                { headers: { Cookie: await sessionCookie(ctx, organizer) } },
            );
            expect(other.status).toBe(400);

            // The cached variant sits in storage without an asset row, so the
            // open asset route cannot be talked into serving it.
            const variantKey = `derivatives/w480/${photo!.assetKey}.webp`;
            expect(await ctx.bucket.getObject(variantKey)).not.toBeNull();
            const leaked = await client.api.assets[":key{.+}"].$get({
                param: { key: variantKey },
            });
            expect(leaked.status).toBe(404);

            // And the photographer still gets nothing, at any width.
            const asPhotographer = await ctx.utils.clientForUser(photographer);
            const denied = await asPhotographer.api.event[
                ":eventId"
            ].wrapped.photos[":photoId"].image.$get({
                param,
                query: { w: "480" },
            });
            expect(denied.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "a member who does not arrange the event sees nothing, not even their own photo",
        async ({ ctx }) => {
            const { event, photographer } = await eventWithPhotos(ctx, 1);
            const client = await ctx.utils.clientForUser(photographer);
            const photos = client.api.event[":eventId"].wrapped.photos;
            const [photo] = await ctx.db.query.wrappedPhoto.findMany();
            const param = { eventId: event.id, photoId: photo!.id };

            const list = await photos.$get({
                param: { eventId: event.id },
                query: {},
            });
            const image = await photos[":photoId"].image.$get({
                param,
                query: {},
            });
            const pick = await photos[":photoId"].$patch({
                param,
                json: { selected: true },
            });

            expect(list.status).toBe(403);
            expect(image.status).toBe(403);
            expect(pick.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "a photo is only reachable through the event it was taken at",
        async ({ ctx }) => {
            const { organizer } = await eventWithPhotos(ctx, 1);
            const other = await createOngoingEvent(ctx);
            const client = await ctx.utils.clientForUser(organizer);
            const [photo] = await ctx.db.query.wrappedPhoto.findMany();
            const param = { eventId: other.id, photoId: photo!.id };

            const image = await client.api.event[":eventId"].wrapped.photos[
                ":photoId"
            ].image.$get({ param, query: {} });
            const pick = await client.api.event[":eventId"].wrapped.photos[
                ":photoId"
            ].$patch({ param, json: { selected: true } });

            expect(image.status).toBe(404);
            expect(pick.status).toBe(404);
        },
        500_000,
    );
});
