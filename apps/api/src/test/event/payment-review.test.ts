import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    notifyOrganizersOfPaymentsWithoutSpot,
    reviewPaymentsForStartedEvents,
} from "~/lib/event/payment-review";
import { integrationTest } from "~/test/config/integration";

/**
 * A member displaced by a prioritised registration keeps their payment on
 * purpose — it is what lets them take a spot back without paying again. That
 * reason expires when the event starts, but the refund itself stays a decision
 * for the arranging group. These tests pin down that somebody is actually asked
 * to make it.
 */
describe("Betalinger uten plass — varsel til arrangør", () => {
    integrationTest(
        "tells the organiser group's leaders who paid without holding a spot",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            const event = await ctx.utils.createTestEvent({
                capacity: 1,
                isPaidEvent: true,
                priceMinor: 7500,
                organizerGroupSlug: "index",
                start: new Date(Date.now() - 60 * 1000),
                end: new Date(Date.now() + 60 * 60 * 1000),
            });

            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "index",
                role: "leader",
            });

            // Paid, but pushed onto the waiting list.
            const displaced = await ctx.auth.api.createUser({
                body: {
                    email: "displaced@test.com",
                    name: "Fortrengt Medlem",
                    password: "test123!",
                },
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: displaced.user.id,
                status: "waitlisted",
                waitlistPosition: 1,
            });
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: displaced.user.id,
                amountMinor: 7500,
                currency: "NOK",
                provider: "vipps",
                providerPaymentId: "vipps-displaced",
                status: "paid",
                receivedPaymentAt: new Date(),
            });

            // Paid and holds the spot — must not be reported.
            const attending = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: attending.id,
                status: "registered",
            });
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: attending.id,
                amountMinor: 7500,
                currency: "NOK",
                provider: "vipps",
                providerPaymentId: "vipps-attending",
                status: "paid",
                receivedPaymentAt: new Date(),
            });

            const notified = await notifyOrganizersOfPaymentsWithoutSpot(
                event.id,
                ctx,
            );
            expect(notified).toBe(1);

            const notifications = await ctx.db.query.notification.findMany({
                where: (n, { eq }) => eq(n.userId, leader.id),
            });
            expect(notifications).toHaveLength(1);
            expect(notifications[0]?.description).toContain("Fortrengt Medlem");
            expect(notifications[0]?.description).not.toContain(attending.name);

            // Claimed, so a second sweep sends nothing.
            const again = await notifyOrganizersOfPaymentsWithoutSpot(
                event.id,
                ctx,
            );
            expect(again).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "also reports someone who paid and then left the event",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            const event = await ctx.utils.createTestEvent({
                capacity: 5,
                isPaidEvent: true,
                priceMinor: 5000,
                organizerGroupSlug: "index",
                start: new Date(Date.now() - 60 * 1000),
                end: new Date(Date.now() + 60 * 60 * 1000),
            });

            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "index",
                role: "leader",
            });

            const gone = await ctx.auth.api.createUser({
                body: {
                    email: "gone@test.com",
                    name: "Avmeldt Medlem",
                    password: "test123!",
                },
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: gone.user.id,
                status: "cancelled",
            });
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: gone.user.id,
                amountMinor: 5000,
                currency: "NOK",
                provider: "vipps",
                providerPaymentId: "vipps-gone",
                status: "paid",
                receivedPaymentAt: new Date(),
            });

            await reviewPaymentsForStartedEvents(ctx);

            const notifications = await ctx.db.query.notification.findMany({
                where: (n, { eq }) => eq(n.userId, leader.id),
            });
            expect(notifications).toHaveLength(1);
            expect(notifications[0]?.description).toContain("Avmeldt Medlem");

            const marked = await ctx.db.query.event.findFirst({
                where: eq(schema.event.id, event.id),
            });
            expect(marked?.paymentReviewNotifiedAt).not.toBeNull();
        },
        500_000,
    );

    integrationTest(
        "says nothing when every payment belongs to someone with a spot",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            await ctx.utils.setupGroups();

            const event = await ctx.utils.createTestEvent({
                capacity: 5,
                isPaidEvent: true,
                priceMinor: 5000,
                organizerGroupSlug: "index",
                start: new Date(Date.now() - 60 * 1000),
                end: new Date(Date.now() + 60 * 60 * 1000),
            });

            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "index",
                role: "leader",
            });

            const attending = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: attending.id,
                status: "registered",
            });
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: attending.id,
                amountMinor: 5000,
                currency: "NOK",
                provider: "vipps",
                providerPaymentId: "vipps-ok",
                status: "paid",
                receivedPaymentAt: new Date(),
            });

            const notified = await notifyOrganizersOfPaymentsWithoutSpot(
                event.id,
                ctx,
            );
            expect(notified).toBe(0);

            const notifications = await ctx.db.query.notification.findMany({
                where: (n, { eq }) => eq(n.userId, leader.id),
            });
            expect(notifications).toHaveLength(0);
        },
        500_000,
    );
});
