import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import {
    createPaymentObligation,
    handlePaymentExpiration,
} from "~/lib/event/payment";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import * as vipps from "~/lib/vipps";
import { integrationTest } from "~/test/config/integration";

vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    cancelPayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

/** A Vipps checkout the member opened but never touched. */
const UNTOUCHED_CHECKOUT = {
    state: "CREATED",
    aggregate: {
        authorizedAmount: { value: 0 },
        capturedAmount: { value: 0 },
        refundedAmount: { value: 0 },
        cancelledAmount: { value: 0 },
    },
};

/** A checkout where Vipps has already reserved the money. */
const RESERVED_CHECKOUT = {
    state: "AUTHORIZED",
    aggregate: {
        authorizedAmount: { value: 51000 },
        capturedAmount: { value: 0 },
        refundedAmount: { value: 0 },
        cancelledAmount: { value: 0 },
    },
};

describe("Duplicate payment obligations", () => {
    integrationTest(
        "the deadline timer leaves a spot alone when the member paid on another row",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            // The obligation they actually paid: a checkout Vipps confirmed.
            const paid = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });
            await ctx.db
                .update(schema.eventPayment)
                .set({
                    status: "paid",
                    provider: "vipps",
                    providerPaymentId: "vipps-ref-123",
                    receivedPaymentAt: new Date(),
                })
                .where(eq(schema.eventPayment.id, paid?.id ?? ""));

            // The spare row a re-registration left behind, with no checkout of
            // its own — this is the one whose timer fires.
            const [stray] = await ctx.db
                .insert(schema.eventPayment)
                .values({
                    eventId: event.id,
                    userId: user.id,
                    amountMinor: 51000,
                    currency: "NOK",
                    status: "pending",
                    expiresAt: new Date(Date.now() + 1000),
                })
                .returning();

            await handlePaymentExpiration(ctx, {
                eventId: event.id,
                userId: user.id,
                paymentId: stray?.id ?? "",
            });

            const registration = await ctx.db.query.eventRegistration.findFirst(
                {
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                },
            );

            expect(registration?.status).toBe("registered");
        },
        500_000,
    );

    integrationTest(
        "a member with a live obligation does not get a second one",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const first = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });

            // They opened a checkout, then signed up again while it was in the
            // air — the same call that handed out the spare row in production.
            await ctx.db
                .update(schema.eventPayment)
                .set({ provider: "vipps", providerPaymentId: "vipps-ref-123" })
                .where(eq(schema.eventPayment.id, first?.id ?? ""));

            const second = await createPaymentObligation(ctx, event, user.id);

            expect(second?.id).toBe(first?.id);

            const rows = await ctx.db.query.eventPayment.findMany({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });
            expect(rows).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "unregistering closes an untouched checkout instead of leaving it open",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            vi.mocked(vipps.getPaymentDetails).mockResolvedValue(
                UNTOUCHED_CHECKOUT as never,
            );

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const obligation = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });
            await ctx.db
                .update(schema.eventPayment)
                .set({ provider: "vipps", providerPaymentId: "vipps-ref-123" })
                .where(eq(schema.eventPayment.id, obligation?.id ?? ""));

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                {
                    param: { eventId: event.id },
                },
            );

            expect(res.status).toBe(200);
            expect(vipps.cancelPayment).toHaveBeenCalledWith("vipps-ref-123");

            const after = await ctx.db.query.eventPayment.findFirst({
                where: (p, { eq }) => eq(p.id, obligation?.id ?? ""),
            });
            expect(after?.status).toBe("failed");
        },
        500_000,
    );

    integrationTest(
        "unregistering is refused while Vipps holds the money",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            vi.mocked(vipps.getPaymentDetails).mockResolvedValue(
                RESERVED_CHECKOUT as never,
            );

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const obligation = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });
            await ctx.db
                .update(schema.eventPayment)
                .set({ provider: "vipps", providerPaymentId: "vipps-ref-456" })
                .where(eq(schema.eventPayment.id, obligation?.id ?? ""));

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].registration.$delete(
                {
                    param: { eventId: event.id },
                },
            );

            expect(res.status).toBe(400);

            // The spot is still theirs — the money is on its way to it.
            const registration = await ctx.db.query.eventRegistration.findFirst(
                {
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                },
            );
            expect(registration?.status).toBe("registered");
        },
        500_000,
    );
});
