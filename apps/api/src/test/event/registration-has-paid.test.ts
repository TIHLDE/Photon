import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

// `hasPaid` is what decides whether the event page offers the member the
// ticket-resale link, so it must stay false until the payment is actually
// completed.
describe("event detail registration.hasPaid", () => {
    integrationTest(
        "is false while the payment for a paid event is still pending",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                isPaidEvent: true,
                priceMinor: 10000,
                paymentGracePeriodMinutes: 30,
            });
            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: user.id,
                amountMinor: 10000,
                status: "pending",
            });

            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(response.status).toBe(200);
            const body = await response.json();
            // 404-svaret er en streng, så smalne typen inn før feltet leses.
            if (typeof body === "string") throw new Error(body);
            expect(body.registration?.hasPaid).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "is true once the payment is completed",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                isPaidEvent: true,
                priceMinor: 10000,
                paymentGracePeriodMinutes: 30,
            });
            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: user.id,
                amountMinor: 10000,
                status: "paid",
            });

            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(response.status).toBe(200);
            const body = await response.json();
            // 404-svaret er en streng, så smalne typen inn før feltet leses.
            if (typeof body === "string") throw new Error(body);
            expect(body.registration?.hasPaid).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "is false on a free event, where no payment exists",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({});
            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);

            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(response.status).toBe(200);
            const body = await response.json();
            // 404-svaret er en streng, så smalne typen inn før feltet leses.
            if (typeof body === "string") throw new Error(body);
            expect(body.registration?.hasPaid).toBe(false);

            // Guard against the free-event path accidentally creating one.
            const payments = await ctx.db.query.eventPayment.findMany({
                where: and(
                    eq(schema.eventPayment.eventId, event.id),
                    eq(schema.eventPayment.userId, user.id),
                ),
            });
            expect(payments).toHaveLength(0);
        },
        500_000,
    );
});
