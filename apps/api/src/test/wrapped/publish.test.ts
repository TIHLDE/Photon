import { EMAIL_QUEUE_NAME, PUSH_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { describe, expect, vi } from "vitest";
import * as deferred from "~/lib/notification/deferred";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import { eventWithPickedPhotos, register } from "./helpers";

async function pushJobs(ctx: IntegrationTestContext) {
    const jobs = await ctx.queue.getQueue(PUSH_QUEUE_NAME).getJobs();
    return jobs.map((job) => job.data as { userId: string; link?: string });
}

async function emailJobCount(ctx: IntegrationTestContext) {
    return (await ctx.queue.getQueue(EMAIL_QUEUE_NAME).getJobs()).length;
}

describe("wrapped story publishing", () => {
    integrationTest(
        "the first publish notifies everyone with a spot, once",
        async ({ ctx }) => {
            const { event, photographer, organizer } =
                await eventWithPickedPhotos(ctx, 2);

            const attended = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            const waitlisted = await ctx.utils.createTestUser();
            const cancelled = await ctx.utils.createTestUser();
            await register(ctx, event.id, attended.id, "attended");
            await register(ctx, event.id, noShow.id, "no_show");
            await register(ctx, event.id, waitlisted.id, "waitlisted");
            await register(ctx, event.id, cancelled.id, "cancelled");
            const holders = [photographer.id, attended.id, noShow.id].sort();

            const client = await ctx.utils.clientForUser(organizer);
            const wrapped = client.api.event[":eventId"].wrapped;
            const param = { eventId: event.id };

            const published = await wrapped.publish.$post({ param });
            expect(published.status).toBe(200);
            const status = await published.json();
            expect(status.publishedAt).not.toBeNull();
            expect(status.firstPublishedAt).toBe(status.publishedAt);

            const rows = await ctx.db.query.notification.findMany();
            expect(rows.map((n) => n.userId).sort()).toEqual(holders);
            for (const row of rows) {
                expect(row.link).toBe(`/arrangementer/${event.slug}/story`);
            }
            const pushes = await pushJobs(ctx);
            expect(pushes.map((p) => p.userId).sort()).toEqual(holders);
            expect(await emailJobCount(ctx)).toBe(0);

            // Publishing a story that is already live notifies nobody, and
            // keeps the time it went live.
            const again = await wrapped.publish.$post({ param });
            expect((await again.json()).publishedAt).toBe(status.publishedAt);
            expect(await ctx.db.query.notification.findMany()).toHaveLength(3);
            expect(await pushJobs(ctx)).toHaveLength(3);
        },
        500_000,
    );

    integrationTest(
        "unpublishing keeps the notifications, and publishing again sends nothing",
        async ({ ctx }) => {
            const { event, photographer, organizer } =
                await eventWithPickedPhotos(ctx, 1);
            const client = await ctx.utils.clientForUser(organizer);
            const wrapped = client.api.event[":eventId"].wrapped;
            const param = { eventId: event.id };

            const first = await (await wrapped.publish.$post({ param })).json();

            const unpublished = await wrapped.unpublish.$post({ param });
            expect(unpublished.status).toBe(200);
            const down = await unpublished.json();
            expect(down.publishedAt).toBeNull();
            expect(down.firstPublishedAt).toBe(first.firstPublishedAt);
            const rows = await ctx.db.query.notification.findMany();
            expect(rows.map((n) => n.userId)).toEqual([photographer.id]);

            const back = await (await wrapped.publish.$post({ param })).json();
            expect(back.publishedAt).not.toBeNull();
            expect(back.firstPublishedAt).toBe(first.firstPublishedAt);
            expect(await ctx.db.query.notification.findMany()).toHaveLength(1);
            expect(await pushJobs(ctx)).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "publishStory reports the first publish only",
        async ({ ctx }) => {
            const { event } = await eventWithPickedPhotos(ctx, 1);
            const { publishStory, unpublishStory } =
                await import("~/lib/wrapped/story");
            const { logger } = await import("~/lib/logger");

            const first = await publishStory(ctx, event.id, logger);
            expect(first).toEqual({ isFirstPublish: true, recipientCount: 1 });

            await unpublishStory(ctx, event.id);
            const second = await publishStory(ctx, event.id, logger);
            expect(second).toEqual({
                isFirstPublish: false,
                recipientCount: 0,
            });
        },
        500_000,
    );

    integrationTest(
        "a failing notification send still publishes the story",
        async ({ ctx }) => {
            const { event, organizer } = await eventWithPickedPhotos(ctx, 1);
            const spy = vi
                .spyOn(deferred, "createDeferredNotifications")
                .mockReturnValue({
                    add: () => {},
                    flush: () => Promise.reject(new Error("queue down")),
                });
            try {
                const client = await ctx.utils.clientForUser(organizer);
                const response = await client.api.event[
                    ":eventId"
                ].wrapped.publish.$post({ param: { eventId: event.id } });

                expect(response.status).toBe(200);
                expect((await response.json()).publishedAt).not.toBeNull();
            } finally {
                spy.mockRestore();
            }
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
