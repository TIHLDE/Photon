import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Innsjekk ved døra skanner medlemsbeviset, som bare er brukerens id. Da er
 * det endepunktet her som må holde på regelen: den som ikke har plass på
 * arrangementet, blir ikke huket av — uansett hvor fint kortet ser ut.
 */
describe("event check-in only accepts users with a spot", () => {
    integrationTest(
        "a registered user is marked as attended",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:update"]);
            const client = await ctx.utils.clientForUser(admin);

            const attendee = await ctx.utils.createTestUser();
            const event = await ctx.utils.createTestEvent({
                slug: `innsjekk-${Date.now()}`,
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: attendee.id,
                status: "registered",
            });

            const response = await client.api.event[":eventId"].registration[
                ":userId"
            ].attendance.$patch({
                param: { eventId: event.id, userId: attendee.id },
                json: { attended: true },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                userId: attendee.id,
                name: attendee.name,
                status: "attended",
            });
        },
        500_000,
    );

    integrationTest(
        "a waitlisted user is rejected and keeps their waitlist spot",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:update"]);
            const client = await ctx.utils.clientForUser(admin);

            const queued = await ctx.utils.createTestUser();
            const event = await ctx.utils.createTestEvent({
                slug: `venteliste-innsjekk-${Date.now()}`,
                capacity: 1,
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: queued.id,
                status: "waitlisted",
            });

            const response = await client.api.event[":eventId"].registration[
                ":userId"
            ].attendance.$patch({
                param: { eventId: event.id, userId: queued.id },
                json: { attended: true },
            });

            expect(response.status).toBe(409);

            const registration = await ctx.db.query.eventRegistration.findFirst(
                {
                    where: and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, queued.id),
                    ),
                },
            );
            expect(registration?.status).toBe("waitlisted");
            expect(registration?.attendedAt).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "a user who never registered is not found",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:update"]);
            const client = await ctx.utils.clientForUser(admin);

            const stranger = await ctx.utils.createTestUser();
            const event = await ctx.utils.createTestEvent({
                slug: `ukjent-innsjekk-${Date.now()}`,
            });

            const response = await client.api.event[":eventId"].registration[
                ":userId"
            ].attendance.$patch({
                param: { eventId: event.id, userId: stranger.id },
                json: { attended: true },
            });

            expect(response.status).toBe(404);

            const registration = await ctx.db.query.eventRegistration.findFirst(
                {
                    where: and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, stranger.id),
                    ),
                },
            );
            expect(registration).toBeUndefined();
        },
        500_000,
    );
});
