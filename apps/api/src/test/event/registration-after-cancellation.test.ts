import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { handlePaymentExpiration } from "~/lib/event/payment";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

// The expiration path reconciles with Vipps before it reclaims a spot. Nothing
// here is about the provider, so stub the module out and let every unstarted
// obligation be judged on its own (missing) reference.
vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

/**
 * A member whose spot the payment deadline reclaimed is told, in the very
 * notification that announces it, that they can sign up again. These tests are
 * about whether that sentence is true.
 */
describe("registering again after a cancelled registration", () => {
    integrationTest(
        "lets a member whose payment deadline expired register again",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            // Round one: take the spot and let the obligation go unpaid.
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const payment = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });
            expect(payment).toBeDefined();

            await handlePaymentExpiration(ctx, {
                eventId: event.id,
                userId: user.id,
                paymentId: payment?.id ?? "",
            });

            const cancelled = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, user.id)),
            });
            expect(cancelled?.status).toBe("cancelled");

            // Round two: exactly what the notification tells them to do.
            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(200);

            // The row is revived in place — the primary key is (userId,
            // eventId), so a second row is not merely undesirable, it cannot
            // exist. Assert the count anyway: it is what proves the revival
            // went through the conflict branch rather than silently no-oping.
            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, user.id)),
            });
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe("pending");
            expect(rows[0]?.waitlistPosition).toBeNull();
            expect(rows[0]?.attendedAt).toBeNull();

            // And the spot is really theirs again once the resolver runs.
            await resolveRegistrationsForEvent(event.id, ctx);
            const revived = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, user.id)),
            });
            expect(revived?.status).toBe("registered");
        },
        500_000,
    );

    integrationTest(
        "still refuses a member who is holding the spot right now",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({ capacity: 10 });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(409);
            const json = (await response.json()) as unknown as {
                message: string;
            };
            expect(json.message).toBe(
                "User is already registered for this event",
            );
        },
        500_000,
    );

    integrationTest(
        "does not revive a cancelled spot when the event is full",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({ capacity: 1 });

            const cancelledUser = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(cancelledUser, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(cancelledUser.id);
            const client = await ctx.utils.clientForUser(cancelledUser);

            await ctx.utils.createPendingRegistration(
                event.id,
                cancelledUser.id,
            );
            await resolveRegistrationsForEvent(event.id, ctx);

            // Their spot is reclaimed and handed to someone else.
            await ctx.db
                .update(schema.eventRegistration)
                .set({ status: "cancelled", waitlistPosition: null })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, cancelledUser.id),
                    ),
                );

            const replacement = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, replacement.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            // Coming back is allowed; jumping the queue is not.
            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(response.status).toBe(200);

            await resolveRegistrationsForEvent(event.id, ctx);

            const returning = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(
                        eq(r.eventId, event.id),
                        eq(r.userId, cancelledUser.id),
                    ),
            });
            expect(returning?.status).toBe("waitlisted");

            const holder = await ctx.db.query.eventRegistration.findFirst({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, event.id), eq(r.userId, replacement.id)),
            });
            expect(holder?.status).toBe("registered");
        },
        500_000,
    );
});
