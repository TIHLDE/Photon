import type { EmailQueueJobData } from "@photon/core/services/email";
import { EMAIL_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { sumBy } from "es-toolkit";
import { describe, expect } from "vitest";
import {
    processEventNoShows,
    processNoShowStrikesForEndedEvents,
} from "~/lib/event/no-show";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

async function register(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
    status: "registered" | "attended" | "no_show" | "waitlisted",
) {
    await ctx.db
        .insert(schema.eventRegistration)
        .values({ eventId, userId, status });
}

async function strikeTotal(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const rows = await ctx.db.query.eventStrike.findMany({
        where: { userId, eventId },
    });
    return sumBy(rows, (r) => r.count);
}

async function statusOf(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const reg = await ctx.db.query.eventRegistration.findFirst({
        where: { eventId, userId },
    });
    return reg?.status;
}

/** An event that has already ended, one hour ago. */
async function endedEvent(
    ctx: IntegrationTestContext,
    canCauseStrikes: boolean,
) {
    const now = Date.now();
    return ctx.utils.createTestEvent({
        canCauseStrikes,
        start: new Date(now - 3 * HOUR),
        end: new Date(now - HOUR),
    });
}

describe("No-show strikes", () => {
    integrationTest(
        "registered users get 2 strikes when someone was checked in",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const attendee = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await register(ctx, event.id, attendee.id, "attended");
            await register(ctx, event.id, noShow.id, "registered");

            const result = await processEventNoShows(event.id, ctx);

            expect(result.processed).toBe(true);
            expect(result.struck).toBe(1);
            expect(await statusOf(ctx, event.id, noShow.id)).toBe("no_show");
            expect(await strikeTotal(ctx, event.id, noShow.id)).toBe(2);
            const notification = await ctx.db.query.notification.findFirst({
                where: { userId: noShow.id },
            });
            expect(notification?.title).toBe("Du har fått 2 prikker");
            expect(notification?.link).toBe(`/profil/${noShow.id}/prikker`);
            // The attendee is untouched.
            expect(await statusOf(ctx, event.id, attendee.id)).toBe("attended");
            expect(await strikeTotal(ctx, event.id, attendee.id)).toBe(0);

            const updated = await ctx.db.query.event.findFirst({
                where: { id: event.id },
            });
            expect(updated?.noShowProcessedAt).not.toBeNull();
        },
        500_000,
    );

    integrationTest(
        "strike email respects the member's mail setting",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const attendee = await ctx.utils.createTestUser();
            const optedOut = await ctx.utils.createTestUser();
            const optedIn = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.userSettings).values({
                userId: optedOut.id,
                gender: "other",
                allowsPhotosByDefault: true,
                acceptsEventRules: true,
                receiveMailCommunication: false,
            });
            await register(ctx, event.id, attendee.id, "attended");
            await register(ctx, event.id, optedOut.id, "registered");
            await register(ctx, event.id, optedIn.id, "registered");

            await processEventNoShows(event.id, ctx);

            const notified = await ctx.db.query.notification.findMany({
                where: { userId: optedOut.id },
            });
            expect(notified).toHaveLength(1);

            const emails = await ctx.queue
                .getQueue<EmailQueueJobData>(EMAIL_QUEUE_NAME)
                .getJobs();
            expect(emails.map((e) => e.data.options.to)).toEqual([
                optedIn.email,
            ]);
        },
        500_000,
    );

    integrationTest(
        "hybrid gate: no strikes when nobody was checked in",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const a = await ctx.utils.createTestUser();
            const b = await ctx.utils.createTestUser();
            await register(ctx, event.id, a.id, "registered");
            await register(ctx, event.id, b.id, "registered");

            const result = await processEventNoShows(event.id, ctx);

            expect(result.processed).toBe(false);
            expect(await statusOf(ctx, event.id, a.id)).toBe("registered");
            expect(await strikeTotal(ctx, event.id, a.id)).toBe(0);
            expect(await strikeTotal(ctx, event.id, b.id)).toBe(0);

            // Left unprocessed so a later run can pick it up after check-in.
            const updated = await ctx.db.query.event.findFirst({
                where: { id: event.id },
            });
            expect(updated?.noShowProcessedAt).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "idempotent: processing twice does not double-strike",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const attendee = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await register(ctx, event.id, attendee.id, "attended");
            await register(ctx, event.id, noShow.id, "registered");

            await processEventNoShows(event.id, ctx);
            await processEventNoShows(event.id, ctx);

            expect(await strikeTotal(ctx, event.id, noShow.id)).toBe(2);
        },
        500_000,
    );

    integrationTest(
        "scan skips events that cannot cause strikes",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, false);
            const attendee = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await register(ctx, event.id, attendee.id, "attended");
            await register(ctx, event.id, noShow.id, "registered");

            await processNoShowStrikesForEndedEvents(ctx);

            expect(await statusOf(ctx, event.id, noShow.id)).toBe("registered");
            expect(await strikeTotal(ctx, event.id, noShow.id)).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "scan processes an ended strike-enabled event end-to-end",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const attendee = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await register(ctx, event.id, attendee.id, "attended");
            await register(ctx, event.id, noShow.id, "registered");

            await processNoShowStrikesForEndedEvents(ctx);

            expect(await statusOf(ctx, event.id, noShow.id)).toBe("no_show");
            expect(await strikeTotal(ctx, event.id, noShow.id)).toBe(2);
        },
        500_000,
    );

    integrationTest(
        "no strike for a no-show who was promoted from the waitlist after the start",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const attendee = await ctx.utils.createTestUser();
            const latePromoted = await ctx.utils.createTestUser();
            const earlyPromoted = await ctx.utils.createTestUser();
            await register(ctx, event.id, attendee.id, "attended");
            await ctx.db.insert(schema.eventRegistration).values([
                {
                    eventId: event.id,
                    userId: latePromoted.id,
                    status: "registered",
                    promotedFromWaitlistAt: new Date(
                        event.start.getTime() + HOUR,
                    ),
                },
                {
                    eventId: event.id,
                    userId: earlyPromoted.id,
                    status: "registered",
                    promotedFromWaitlistAt: new Date(
                        event.start.getTime() - HOUR,
                    ),
                },
            ]);

            const result = await processEventNoShows(event.id, ctx);

            expect(result.struck).toBe(1);
            expect(await strikeTotal(ctx, event.id, latePromoted.id)).toBe(0);
            expect(await strikeTotal(ctx, event.id, earlyPromoted.id)).toBe(2);
        },
        500_000,
    );
});

describe("Unregistering after the event has ended", () => {
    async function unregister(
        ctx: IntegrationTestContext,
        user: Awaited<
            ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
        >,
        eventId: string,
    ) {
        const client = await ctx.utils.clientForUser(user);
        return client.api.event[":eventId"].registration.$delete({
            param: { eventId },
        });
    }

    integrationTest(
        "a no-show cannot trade two strikes for one or promote the waitlist",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await endedEvent(ctx, true);
            const attendee = await ctx.utils.createTestUser();
            const skipper = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();
            await register(ctx, event.id, attendee.id, "attended");
            await register(ctx, event.id, skipper.id, "registered");
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: waiting.id,
                status: "waitlisted",
                waitlistPosition: 1,
            });

            const res = await unregister(ctx, skipper, event.id);

            expect(res.status).toBe(400);
            expect(await statusOf(ctx, event.id, waiting.id)).toBe(
                "waitlisted",
            );

            await processEventNoShows(event.id, ctx);
            expect(await strikeTotal(ctx, event.id, skipper.id)).toBe(2);
        },
        500_000,
    );

    for (const status of ["attended", "no_show"] as const) {
        integrationTest(
            `an ${status} record cannot be erased`,
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const event = await endedEvent(ctx, true);
                const member = await ctx.utils.createTestUser();
                await register(ctx, event.id, member.id, status);

                const res = await unregister(ctx, member, event.id);

                expect(res.status).toBe(400);
                expect(await statusOf(ctx, event.id, member.id)).toBe(status);
            },
            500_000,
        );
    }
});
