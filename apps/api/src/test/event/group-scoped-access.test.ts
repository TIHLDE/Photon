import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Event access is answered per organiser group, not only globally: a leader
 * with `events:create@group:<slug>` arranges their own group's events and
 * nobody else's. A global grant still matches every group, so the old
 * behaviour is unchanged — the non-regression case below pins that down.
 */

const eventBody = (organizerGroupSlug: string) => ({
    title: "Test Event",
    description: "A test event description",
    categorySlug: "bedpres",
    organizerGroupSlug,
    location: "Oslo, Norway",
    imageUrl: null,
    start: "2025-12-01T18:00:00Z",
    end: "2025-12-01T20:00:00Z",
    registrationStart: null,
    registrationEnd: "2025-11-30T23:59:59Z",
    cancellationDeadline: null,
    capacity: 50,
    isRegistrationClosed: false,
    requiresSigningUp: true,
    allowWaitlist: true,
    priorityPools: null,
    onlyAllowPrioritized: false,
    canCauseStrikes: false,
    enforcesPreviousStrikes: false,
    isPaidEvent: false,
    price: null,
    paymentGracePeriodMinutes: null,
    contactPersonUserId: null,
    reactionsAllowed: true,
});

describe("group-scoped event access", () => {
    integrationTest(
        "a group leader with leader permissions can create events for their own group only",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const group = await ctx.utils.createTestGroup({
                slug: "fadderkom-test",
            });
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["events:create"] })
                .where(eq(schema.group.slug, group.slug));
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const own = await client.api.event.$post({
                json: eventBody(group.slug),
            });
            expect(own.status).toBe(201);

            const other = await client.api.event.$post({
                json: eventBody("index"),
            });
            expect(other.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "a global events:create still works for any group (non-regression)",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: eventBody("index"),
            });

            expect(response.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "a leader cannot update another group's event",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const group = await ctx.utils.createTestGroup({
                slug: "fadderkom-update-test",
            });
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["events:update"] })
                .where(eq(schema.group.slug, group.slug));
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const foreign = await ctx.utils.createTestEvent({
                organizerGroupSlug: "index",
            });

            const response = await client.api.event[":id"].$put({
                param: { id: foreign.id },
                json: eventBody("index"),
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    /**
     * Arranging the group's own events is baseline for every leader — no
     * `leaderPermissions` configured, no verv, no role beyond the default.
     */
    integrationTest(
        "leadership alone lets a leader create, update and delete their group's events",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            // Deliberately left with the empty default leaderPermissions.
            const group = await ctx.utils.createTestGroup({
                slug: "plask-test",
            });
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const created = await client.api.event.$post({
                json: eventBody(group.slug),
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            const updated = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: eventBody(group.slug),
            });
            expect(updated.status).toBe(200);

            // Someone else's event stays closed.
            const foreign = await ctx.utils.createTestEvent({
                organizerGroupSlug: "index",
            });
            const foreignUpdate = await client.api.event[":id"].$put({
                param: { id: foreign.id },
                json: eventBody("index"),
            });
            expect(foreignUpdate.status).toBe(403);

            const deleted = await client.api.event[":eventId"].$delete({
                param: { eventId },
            });
            expect(deleted.status).toBe(200);
        },
        500_000,
    );

    /**
     * The baseline stops short of money and prikker: a leader sees who has
     * paid for their own arrangement, but refunds and manual strikes are
     * someone else's call.
     */
    integrationTest(
        "the leader baseline covers payments:view and check-in, but not refunds or strikes",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);
            const attendee = await ctx.utils.createTestUser();

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const group = await ctx.utils.createTestGroup({
                slug: "plask-payments-test",
            });
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const event = await ctx.utils.createTestEvent({
                organizerGroupSlug: group.slug,
                isPaidEvent: true,
            });
            // "registered", not pending — only a real spot can be checked in.
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: attendee.id,
                status: "registered",
            });

            const payments = await client.api.event[":eventId"].payments.$get({
                param: { eventId: event.id },
                query: {},
            });
            expect(payments.status).toBe(200);

            const checkin = await client.api.event[":eventId"].registration[
                ":userId"
            ].attendance.$patch({
                param: { eventId: event.id, userId: attendee.id },
                json: { attended: true },
            });
            expect(checkin.status).toBe(200);

            // Access is checked before the payment is looked up, so a made-up
            // id still proves the grant is missing rather than the row.
            const refund = await client.api.event[":eventId"].payments[
                ":paymentId"
            ].refund.$post({
                param: {
                    eventId: event.id,
                    paymentId: "00000000-0000-4000-8000-000000000000",
                },
            });
            expect(refund.status).toBe(403);

            const strike = await client.api.event.strikes.$post({
                json: {
                    userId: attendee.id,
                    eventId: event.id,
                    count: 1,
                    reason: "Møtte ikke opp",
                },
            });
            expect(strike.status).toBe(403);
        },
        500_000,
    );
});
