import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("my upcoming registrations", () => {
    integrationTest(
        "returns every upcoming registration, activities included, and leaves out past ones",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();

            const bedpres = await ctx.utils.createTestEvent({
                title: "Bedpres",
                slug: `bedpres-${now}`,
                categorySlug: "bedpres",
                start: new Date(now + 2 * DAY),
                end: new Date(now + 2 * DAY + 2 * HOUR),
            });
            const activity = await ctx.utils.createTestEvent({
                title: "Aktivitet",
                slug: `aktivitet-${now}`,
                categorySlug: "aktivitet",
                start: new Date(now + DAY),
                end: new Date(now + DAY + 2 * HOUR),
            });
            const waitlisted = await ctx.utils.createTestEvent({
                title: "Fullt arrangement",
                slug: `fullt-${now}`,
                categorySlug: "sosialt",
                start: new Date(now + 3 * DAY),
                end: new Date(now + 3 * DAY + 2 * HOUR),
            });
            const past = await ctx.utils.createTestEvent({
                title: "Ferdig arrangement",
                slug: `ferdig-${now}`,
                categorySlug: "sosialt",
                start: new Date(now - 2 * DAY),
                end: new Date(now - 2 * DAY + 2 * HOUR),
            });

            const user = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventRegistration).values([
                { eventId: bedpres.id, userId: user.id, status: "registered" },
                { eventId: activity.id, userId: user.id, status: "registered" },
                {
                    eventId: waitlisted.id,
                    userId: user.id,
                    status: "waitlisted",
                    waitlistPosition: 3,
                },
                { eventId: past.id, userId: user.id, status: "attended" },
                { eventId: bedpres.id, userId: other.id, status: "registered" },
            ]);

            const client = await ctx.utils.clientForUser(user);
            const response =
                await client.api.event["my-upcoming-registrations"].$get();

            expect(response.status).toBe(200);
            const body = await response.json();

            // Soonest first, and the activity is in the list rather than
            // filtered out with the other categories.
            expect(body.map((e) => e.slug)).toEqual([
                activity.slug,
                bedpres.slug,
                waitlisted.slug,
            ]);
            expect(body.map((e) => e.categorySlug)).toContain("aktivitet");

            const waitlistRow = body.find((e) => e.slug === waitlisted.slug);
            expect(waitlistRow?.status).toBe("waitlisted");
            expect(waitlistRow?.waitlistPosition).toBe(3);
        },
        500_000,
    );
});
