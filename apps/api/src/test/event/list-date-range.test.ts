import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const DAY = 24 * 60 * 60 * 1000;

describe("event list start date range", () => {
    integrationTest(
        "startFrom and startBefore return past and upcoming events in the range",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const at = (offsetDays: number) => {
                const start = new Date(now + offsetDays * DAY);
                return {
                    start,
                    end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
                };
            };

            const beforeRange = await ctx.utils.createTestEvent({
                slug: `before-${now}`,
                ...at(-40),
            });
            const pastInRange = await ctx.utils.createTestEvent({
                slug: `past-${now}`,
                ...at(-5),
            });
            const upcomingInRange = await ctx.utils.createTestEvent({
                slug: `upcoming-${now}`,
                ...at(5),
            });
            const afterRange = await ctx.utils.createTestEvent({
                slug: `after-${now}`,
                ...at(40),
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({
                query: {
                    startFrom: new Date(now - 10 * DAY).toISOString(),
                    startBefore: new Date(now + 10 * DAY).toISOString(),
                },
            });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(pastInRange.id);
            expect(ids).toContain(upcomingInRange.id);
            expect(ids).not.toContain(beforeRange.id);
            expect(ids).not.toContain(afterRange.id);
            expect(body.totalCount).toBe(2);
        },
        500_000,
    );

    integrationTest(
        "startBefore is exclusive",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const start = new Date(Date.now() + 3 * DAY);
            const event = await ctx.utils.createTestEvent({
                slug: `boundary-${start.getTime()}`,
                start,
                end: new Date(start.getTime() + 60 * 60 * 1000),
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({
                query: { startBefore: start.toISOString() },
            });
            const body = await response.json();
            expect(body.items.map((e) => e.id)).not.toContain(event.id);
        },
        500_000,
    );

    integrationTest(
        "rejects a startFrom that is not an ISO datetime",
        async ({ ctx }) => {
            const client = ctx.utils.client();
            const response = await client.api.event.$get({
                query: { startFrom: "last tuesday" },
            });
            expect(response.status).toBe(400);
        },
        500_000,
    );
});
