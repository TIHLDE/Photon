import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

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

describe("Late cancellation strikes", () => {
    integrationTest(
        "unregistering a confirmed spot after the deadline gives 1 strike",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                canCauseStrikes: true,
                cancellationDeadline: new Date(now - 2 * HOUR),
                start: new Date(now + HOUR),
                end: new Date(now + 3 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "registered",
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                {
                    param: { eventId: event.id },
                },
            );

            expect(res.status).toBe(200);
            expect(await strikeTotal(ctx, event.id, user.id)).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "unregistering before the deadline gives no strike",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                canCauseStrikes: true,
                cancellationDeadline: new Date(now + 2 * HOUR),
                start: new Date(now + 3 * HOUR),
                end: new Date(now + 5 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "registered",
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                {
                    param: { eventId: event.id },
                },
            );

            expect(res.status).toBe(200);
            expect(await strikeTotal(ctx, event.id, user.id)).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "no strike when the event cannot cause strikes",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                canCauseStrikes: false,
                cancellationDeadline: new Date(now - 2 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "registered",
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                {
                    param: { eventId: event.id },
                },
            );

            expect(res.status).toBe(200);
            expect(await strikeTotal(ctx, event.id, user.id)).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "waitlisted users are not struck for late unregistration",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                canCauseStrikes: true,
                cancellationDeadline: new Date(now - 2 * HOUR),
            });
            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: user.id,
                status: "waitlisted",
                waitlistPosition: 1,
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                {
                    param: { eventId: event.id },
                },
            );

            expect(res.status).toBe(200);
            expect(await strikeTotal(ctx, event.id, user.id)).toBe(0);
        },
        500_000,
    );
});
