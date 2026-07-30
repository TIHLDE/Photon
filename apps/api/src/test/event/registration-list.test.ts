import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * Seed an event with one registered user, one waitlisted and one cancelled.
 */
async function seedRegistrations(ctx: IntegrationTestContext) {
    await ctx.utils.setupEventCategories();
    const event = await ctx.utils.createTestEvent({
        isPaidEvent: true,
        priceMinor: 5000,
    });

    const registered = await ctx.utils.createTestUser();
    const waitlisted = await ctx.utils.createTestUser();
    const cancelled = await ctx.utils.createTestUser();

    await ctx.db.insert(schema.eventRegistration).values([
        { eventId: event.id, userId: registered.id, status: "registered" },
        {
            eventId: event.id,
            userId: waitlisted.id,
            status: "waitlisted",
            waitlistPosition: 1,
        },
        { eventId: event.id, userId: cancelled.id, status: "cancelled" },
    ]);

    return { event, registered, waitlisted, cancelled };
}

describe("Event registration listing", () => {
    integrationTest(
        // Regression guard: the public event page renders totalCount as the
        // visible registration count.
        "hides admin fields and non-registered statuses from anonymous callers",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);

            const client = ctx.utils.client();
            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.totalCount).toBe(1);
            const [user] = body.registeredUsers;
            expect(user?.email).toBeUndefined();
            expect(user?.status).toBeUndefined();
            expect(user?.payment).toBeUndefined();
            expect(user?.waitlistPosition).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "returns the same default set for admins, with admin fields added",
        async ({ ctx }) => {
            const { event, registered } = await seedRegistrations(ctx);
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: registered.id,
                amountMinor: 5000,
                currency: "NOK",
                status: "paid",
                providerPaymentId: "ref-1",
            });

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            // Default is unchanged: waitlisted/cancelled are still excluded.
            expect(body.totalCount).toBe(1);

            const [user] = body.registeredUsers;
            expect(user?.email).toBe(registered.email);
            expect(user?.status).toBe("registered");
            expect(user?.registeredAt).toBeDefined();
            expect(user?.payment?.status).toBe("paid");
            expect(user?.payment?.amountMinor).toBe(5000);
        },
        500_000,
    );

    integrationTest(
        "lets admins filter to waitlisted and cancelled registrations",
        async ({ ctx }) => {
            const { event, waitlisted } = await seedRegistrations(ctx);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { status: "waitlisted,cancelled" },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.totalCount).toBe(2);
            const waitlistedRow = body.registeredUsers.find(
                (u) => u.id === waitlisted.id,
            );
            expect(waitlistedRow?.status).toBe("waitlisted");
            expect(waitlistedRow?.waitlistPosition).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "rejects status filtering from non-admins",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { status: "waitlisted" },
            });

            expect(res.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "rejects an unknown status",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { status: "tullestatus" },
            });

            expect(res.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "prefers the paid payment when a user has several rows",
        async ({ ctx }) => {
            const { event, registered } = await seedRegistrations(ctx);
            await ctx.db.insert(schema.eventPayment).values([
                {
                    eventId: event.id,
                    userId: registered.id,
                    amountMinor: 5000,
                    status: "failed",
                    providerPaymentId: "ref-failed",
                },
                {
                    eventId: event.id,
                    userId: registered.id,
                    amountMinor: 5000,
                    status: "paid",
                    providerPaymentId: "ref-paid",
                },
            ]);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            const body = await res.json();
            expect(body.registeredUsers[0]?.payment?.status).toBe("paid");
        },
        500_000,
    );
});
