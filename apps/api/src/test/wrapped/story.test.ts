import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import { eventWithPickedPhotos, markPublished, sessionCookie } from "./helpers";

describe("wrapped story", () => {
    integrationTest(
        "a member reads the event and the picked photos, oldest first",
        async ({ ctx }) => {
            const { event, photographer } = await eventWithPickedPhotos(ctx, 3);
            const photos = await ctx.db.query.wrappedPhoto.findMany({
                orderBy: { createdAt: "asc", id: "asc" },
            });
            // One photo not picked: it must stay out of the story.
            await ctx.db
                .update(schema.wrappedPhoto)
                .set({ selectedAt: null })
                .where(eq(schema.wrappedPhoto.id, photos[1]!.id));
            await markPublished(ctx, event.id);

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);
            const response = await client.api.event[
                ":eventId"
            ].wrapped.story.$get({ param: { eventId: event.id }, query: {} });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.event).toMatchObject({
                id: event.id,
                slug: event.slug,
                title: event.title,
            });
            expect(body.publishedAt).not.toBeNull();
            expect(body.totalCount).toBe(2);
            expect(body.items.map((p) => p.id)).toEqual([
                photos[0]!.id,
                photos[2]!.id,
            ]);
            expect(body.items[0]).toMatchObject({
                photographer: { id: photographer.id, name: photographer.name },
                likeCount: 0,
                likedByMe: false,
                commentCount: 0,
                imageUrl: `/api/event/${event.id}/wrapped/story/photos/${photos[0]!.id}/image`,
            });
        },
        500_000,
    );

    integrationTest(
        "likes and comments are counted per photo",
        async ({ ctx }) => {
            const { event, photographer } = await eventWithPickedPhotos(ctx, 2);
            await markPublished(ctx, event.id);
            const [first] = await ctx.db.query.wrappedPhoto.findMany({
                orderBy: { createdAt: "asc", id: "asc" },
            });
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.wrappedPhotoLike).values([
                { photoId: first!.id, userId: member.id },
                { photoId: first!.id, userId: photographer.id },
            ]);
            await ctx.db.insert(schema.wrappedPhotoComment).values({
                photoId: first!.id,
                userId: photographer.id,
                body: "For en kveld!",
            });

            const client = await ctx.utils.clientForUser(member);
            const body = await (
                await client.api.event[":eventId"].wrapped.story.$get({
                    param: { eventId: event.id },
                    query: {},
                })
            ).json();

            expect(body.items[0]).toMatchObject({
                likeCount: 2,
                likedByMe: true,
                commentCount: 1,
            });
            expect(body.items[1]).toMatchObject({
                likeCount: 0,
                likedByMe: false,
                commentCount: 0,
            });
        },
        500_000,
    );

    integrationTest(
        "an unpublished story is 404 to members and a preview for the organizer",
        async ({ ctx }) => {
            const { event, photographer, organizer } =
                await eventWithPickedPhotos(ctx, 1);
            const param = { eventId: event.id };

            const memberClient = await ctx.utils.clientForUser(photographer);
            const asMember = await memberClient.api.event[
                ":eventId"
            ].wrapped.story.$get({ param, query: {} });
            expect(asMember.status).toBe(404);

            const organizerClient = await ctx.utils.clientForUser(organizer);
            const asOrganizer = await organizerClient.api.event[
                ":eventId"
            ].wrapped.story.$get({ param, query: {} });
            expect(asOrganizer.status).toBe(200);
            expect((await asOrganizer.json()).publishedAt).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "logged out gets 401",
        async ({ ctx }) => {
            const { event } = await eventWithPickedPhotos(ctx, 1);
            await markPublished(ctx, event.id);

            const response = await ctx.app.request(
                `/api/event/${event.id}/wrapped/story`,
            );
            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "the image route serves picked photos of a published story only",
        async ({ ctx }) => {
            const { event } = await eventWithPickedPhotos(ctx, 2);
            const [picked, unpicked] = await ctx.db.query.wrappedPhoto.findMany(
                { orderBy: { createdAt: "asc", id: "asc" } },
            );
            await ctx.db
                .update(schema.wrappedPhoto)
                .set({ selectedAt: null })
                .where(eq(schema.wrappedPhoto.id, unpicked!.id));

            const member = await ctx.utils.createTestUser();
            const cookie = await sessionCookie(ctx, member);
            const image = (photoId: string) =>
                ctx.app.request(
                    `/api/event/${event.id}/wrapped/story/photos/${photoId}/image`,
                    { headers: { Cookie: cookie } },
                );

            expect((await image(picked!.id)).status).toBe(404);

            await markPublished(ctx, event.id);
            const served = await image(picked!.id);
            expect(served.status).toBe(200);
            expect(served.headers.get("Cache-Control")).toBe(
                "private, no-store",
            );
            expect((await image(unpicked!.id)).status).toBe(404);
        },
        500_000,
    );
});
