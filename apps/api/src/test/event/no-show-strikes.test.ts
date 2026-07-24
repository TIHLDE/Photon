import { schema } from "@photon/db";
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
    status: "registered" | "attended" | "waitlisted",
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
        where: (s, { and, eq }) =>
            and(eq(s.userId, userId), eq(s.eventId, eventId)),
    });
    return rows.reduce((total, r) => total + r.count, 0);
}

async function statusOf(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const reg = await ctx.db.query.eventRegistration.findFirst({
        where: (r, { and, eq }) =>
            and(eq(r.eventId, eventId), eq(r.userId, userId)),
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
            // The attendee is untouched.
            expect(await statusOf(ctx, event.id, attendee.id)).toBe("attended");
            expect(await strikeTotal(ctx, event.id, attendee.id)).toBe(0);

            const updated = await ctx.db.query.event.findFirst({
                where: (e, { eq }) => eq(e.id, event.id),
            });
            expect(updated?.noShowProcessedAt).not.toBeNull();
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
                where: (e, { eq }) => eq(e.id, event.id),
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
});
