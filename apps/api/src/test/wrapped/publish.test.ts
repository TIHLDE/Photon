import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import { eventWithPickedPhotos } from "./helpers";

describe("wrapped story publishing", () => {
    integrationTest(
        "publishing notifies everyone with a spot; unpublishing takes the notifications back",
        async ({ ctx }) => {
            const { event, photographer, organizer } =
                await eventWithPickedPhotos(ctx, 2);

            const attended = await ctx.utils.createTestUser();
            const waitlisted = await ctx.utils.createTestUser();
            const cancelled = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values([
                { eventId: event.id, userId: attended.id, status: "attended" },
                {
                    eventId: event.id,
                    userId: waitlisted.id,
                    status: "waitlisted",
                },
                {
                    eventId: event.id,
                    userId: cancelled.id,
                    status: "cancelled",
                },
            ]);

            const client = await ctx.utils.clientForUser(organizer);
            const wrapped = client.api.event[":eventId"].wrapped;
            const param = { eventId: event.id };

            const published = await wrapped.publish.$post({ param });
            expect(published.status).toBe(200);
            const status = await published.json();
            expect(status.publishedAt).not.toBeNull();
            expect(status.firstPublishedAt).toBe(status.publishedAt);

            const notified = async () =>
                (await ctx.db.query.notification.findMany()).map(
                    (n) => n.userId,
                );
            expect((await notified()).sort()).toEqual(
                [photographer.id, attended.id].sort(),
            );
            const [notification] = await ctx.db.query.notification.findMany();
            expect(notification?.link).toBe(
                `/arrangementer/${event.slug}/story`,
            );

            // Publishing a story that is already live notifies nobody.
            await wrapped.publish.$post({ param });
            expect(await notified()).toHaveLength(2);

            const unpublished = await wrapped.unpublish.$post({ param });
            expect(unpublished.status).toBe(200);
            expect((await unpublished.json()).publishedAt).toBeNull();
            expect(await notified()).toHaveLength(0);

            // Back live: notified again, one notification each.
            const again = await wrapped.publish.$post({ param });
            expect(again.status).toBe(200);
            const againStatus = await again.json();
            expect(againStatus.publishedAt).not.toBeNull();
            expect(againStatus.firstPublishedAt).toBe(status.firstPublishedAt);
            expect((await notified()).sort()).toEqual(
                [photographer.id, attended.id].sort(),
            );
        },
        500_000,
    );

    integrationTest(
        "unpublishing leaves other notifications alone",
        async ({ ctx }) => {
            const { event, photographer, organizer } =
                await eventWithPickedPhotos(ctx, 1);
            await ctx.db.insert(schema.notification).values({
                userId: photographer.id,
                title: "Noe annet",
                description: "Et varsel som ikke gjelder storyen",
                link: `/arrangementer/${event.slug}`,
            });
            const client = await ctx.utils.clientForUser(organizer);
            const wrapped = client.api.event[":eventId"].wrapped;
            const param = { eventId: event.id };

            await wrapped.publish.$post({ param });
            await wrapped.unpublish.$post({ param });

            const left = await ctx.db.query.notification.findMany();
            expect(left.map((n) => n.title)).toEqual(["Noe annet"]);
        },
        500_000,
    );

    integrationTest(
        "publishing with no picked photos is refused",
        async ({ ctx }) => {
            const { event, organizer } = await eventWithPickedPhotos(ctx, 0);
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.event[
                ":eventId"
            ].wrapped.publish.$post({ param: { eventId: event.id } });

            expect(response.status).toBe(409);
            const camera = await ctx.db.query.wrappedCamera.findFirst({
                where: { eventId: event.id },
            });
            expect(camera?.publishedAt).toBeNull();
            expect(await ctx.db.query.notification.findMany()).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "only the organizer can publish or unpublish",
        async ({ ctx }) => {
            const { event, photographer } = await eventWithPickedPhotos(ctx, 1);
            const client = await ctx.utils.clientForUser(photographer);
            const wrapped = client.api.event[":eventId"].wrapped;
            const param = { eventId: event.id };

            expect((await wrapped.publish.$post({ param })).status).toBe(403);
            expect((await wrapped.unpublish.$post({ param })).status).toBe(403);
            const camera = await ctx.db.query.wrappedCamera.findFirst({
                where: { eventId: event.id },
            });
            expect(camera?.publishedAt).toBeNull();
        },
        500_000,
    );
});
