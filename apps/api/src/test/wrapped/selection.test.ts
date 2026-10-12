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
    uploadPhoto,
} from "./helpers";

/** An event with one photographer who has taken `count` photos. */
async function eventWithPhotos(ctx: IntegrationTestContext, count: number) {
    const event = await createOngoingEvent(ctx);
    await enableCamera(ctx, event.id);

    const photographer = await ctx.utils.createTestUser();
    await register(ctx, event.id, photographer.id);
    const cookie = await sessionCookie(ctx, photographer);
    for (let i = 0; i < count; i++) {
        await uploadPhoto(ctx, cookie, event.id);
    }

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
            const image = await photos[":photoId"].image.$get({ param });
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
            ].image.$get({ param });
            const pick = await client.api.event[":eventId"].wrapped.photos[
                ":photoId"
            ].$patch({ param, json: { selected: true } });

            expect(image.status).toBe(404);
            expect(pick.status).toBe(404);
        },
        500_000,
    );
});
