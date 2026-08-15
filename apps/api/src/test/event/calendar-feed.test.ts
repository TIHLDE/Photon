import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("kalender-abonnement", () => {
    integrationTest(
        "gir en .ics-strøm med brukerens egne påmeldinger",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const mine = await ctx.utils.createTestEvent({
                title: "Mitt arrangement",
                slug: `mitt-${now}`,
                location: "R1",
            });
            const waitlisted = await ctx.utils.createTestEvent({
                title: "Ventelistearrangement",
                slug: `venteliste-${now}`,
            });
            const someoneElses = await ctx.utils.createTestEvent({
                title: "Andres arrangement",
                slug: `andres-${now}`,
            });
            const cancelled = await ctx.utils.createTestEvent({
                title: "Avmeldt arrangement",
                slug: `avmeldt-${now}`,
            });

            const user = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventRegistration).values([
                { eventId: mine.id, userId: user.id, status: "registered" },
                {
                    eventId: waitlisted.id,
                    userId: user.id,
                    status: "waitlisted",
                },
                {
                    eventId: cancelled.id,
                    userId: user.id,
                    status: "cancelled",
                },
                {
                    eventId: someoneElses.id,
                    userId: other.id,
                    status: "registered",
                },
            ]);

            const client = await ctx.utils.clientForUser(user);
            const subscription = await client.api.user.me.calendar.$get();
            expect(subscription.status).toBe(200);
            const { url } = await subscription.json();

            const token = url.split("/calendar/")[1]?.split("/")[0] as string;
            expect(token).toBeTruthy();

            // Kalenderklienter har ingen sesjon — strømmen må virke uten
            // innlogging, kun med nøkkelen i URL-en.
            const anonymous = ctx.utils.client();
            const feed = await anonymous.api.event.calendar[":token"][
                "events.ics"
            ].$get({ param: { token } });

            expect(feed.status).toBe(200);
            expect(feed.headers.get("content-type")).toContain("text/calendar");

            const body = await feed.text();
            expect(body).toContain("SUMMARY:Mitt arrangement");
            expect(body).toContain("LOCATION:R1");
            expect(body).toContain(
                "SUMMARY:[Venteliste] Ventelistearrangement",
            );
            expect(body).toContain("STATUS:TENTATIVE");
            expect(body).not.toContain("Andres arrangement");
            expect(body).not.toContain("Avmeldt arrangement");
        },
        500_000,
    );

    integrationTest(
        "ny URL gjør den gamle ubrukelig",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const first = await client.api.user.me.calendar.$get();
            const { url: firstUrl } = await first.json();
            const firstToken = firstUrl
                .split("/calendar/")[1]
                ?.split("/")[0] as string;

            // Samme URL så lenge man ikke ber om en ny.
            const again = await client.api.user.me.calendar.$get();
            expect((await again.json()).url).toBe(firstUrl);

            const rotated =
                await client.api.user.me.calendar.regenerate.$post();
            expect(rotated.status).toBe(200);
            const { url: newUrl } = await rotated.json();
            expect(newUrl).not.toBe(firstUrl);

            const anonymous = ctx.utils.client();
            const oldFeed = await anonymous.api.event.calendar[":token"][
                "events.ics"
            ].$get({ param: { token: firstToken } });
            expect(oldFeed.status).toBe(404);

            const newToken = newUrl
                .split("/calendar/")[1]
                ?.split("/")[0] as string;
            const newFeed = await anonymous.api.event.calendar[":token"][
                "events.ics"
            ].$get({ param: { token: newToken } });
            expect(newFeed.status).toBe(200);
        },
        500_000,
    );
});
