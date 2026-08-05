import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("event list organizer filter", () => {
    integrationTest(
        "organizerGroupSlug returns only the events that group organises",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestGroup({
                slug: `organizer-${Date.now()}`,
            });
            const otherGroup = await ctx.utils.createTestGroup({
                slug: `other-${Date.now()}`,
            });

            const ownEvent = await ctx.utils.createTestEvent({
                title: "Own Event",
                slug: `own-${Date.now()}`,
                organizerGroupSlug: organizer.slug,
            });
            const otherEvent = await ctx.utils.createTestEvent({
                title: "Other Event",
                slug: `other-event-${Date.now()}`,
                organizerGroupSlug: otherGroup.slug,
            });
            const unorganizedEvent = await ctx.utils.createTestEvent({
                title: "Unorganized Event",
                slug: `unorganized-${Date.now()}`,
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({
                query: { organizerGroupSlug: organizer.slug },
            });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(ownEvent.id);
            expect(ids).not.toContain(otherEvent.id);
            expect(ids).not.toContain(unorganizedEvent.id);
            // totalCount drives the pagination, so it has to be filtered too.
            expect(body.totalCount).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "omitting organizerGroupSlug keeps events from every organizer",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestGroup({
                slug: `organizer-all-${Date.now()}`,
            });

            const organizedEvent = await ctx.utils.createTestEvent({
                title: "Organized Event",
                slug: `organized-${Date.now()}`,
                organizerGroupSlug: organizer.slug,
            });
            const unorganizedEvent = await ctx.utils.createTestEvent({
                title: "Unorganized Event",
                slug: `no-organizer-${Date.now()}`,
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({ query: {} });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(organizedEvent.id);
            expect(ids).toContain(unorganizedEvent.id);
        },
        500_000,
    );
});
