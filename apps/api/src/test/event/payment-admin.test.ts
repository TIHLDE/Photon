import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, vi } from "vitest";
import * as vipps from "~/lib/vipps";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

// The refund path talks to Vipps; stub the whole module. Every export the app
// imports must be present here — this factory *replaces* the module.
vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

/** Make the provider report a fully captured, unrefunded payment. */
function mockCaptured(amount: number, refunded = 0) {
    vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
        aggregate: {
            authorizedAmount: { currency: "NOK", value: amount },
            capturedAmount: { currency: "NOK", value: amount },
            refundedAmount: { currency: "NOK", value: refunded },
            cancelledAmount: { currency: "NOK", value: 0 },
        },
    } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);
}

beforeEach(() => {
    vi.mocked(vipps.refundPayment).mockClear();
    vi.mocked(vipps.getPaymentDetails).mockClear();
});

describe("Event payment administration", () => {
    describe("GET /:eventId/payments", () => {
        integrationTest(
            "rejects unauthenticated callers",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const event = await ctx.utils.createTestEvent();

                const client = ctx.utils.client();
                const res = await client.api.event[":eventId"].payments.$get({
                    param: { eventId: event.id },
                    query: {},
                });

                expect(res.status).toBe(401);
            },
            500_000,
        );

        integrationTest(
            "rejects a plain member",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const event = await ctx.utils.createTestEvent();
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const res = await client.api.event[":eventId"].payments.$get({
                    param: { eventId: event.id },
                    query: {},
                });

                expect(res.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "allows events:payments:view and returns payments with a summary",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const event = await ctx.utils.createTestEvent({
                    isPaidEvent: true,
                    priceMinor: 10000,
                });

                const payer = await ctx.utils.createTestUser();
                await ctx.db.insert(schema.eventPayment).values([
                    {
                        eventId: event.id,
                        userId: payer.id,
                        amountMinor: 10000,
                        currency: "NOK",
                        provider: "vipps",
                        providerPaymentId: "ref-paid",
                        status: "paid",
                    },
                ]);

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:view",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments.$get({
                    param: { eventId: event.id },
                    query: {},
                });

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.totalCount).toBe(1);
                expect(body.payments).toHaveLength(1);
                expect(body.payments[0]?.user.email).toBe(payer.email);
                expect(body.payments[0]?.status).toBe("paid");
                expect(body.summary.paidCount).toBe(1);
                expect(body.summary.totalPaidMinor).toBe(10000);
            },
            500_000,
        );

        integrationTest(
            // Regression guard: hasPermission is an exact match with no
            // hierarchy, so events:manage must be listed explicitly.
            "allows a caller holding only events:manage",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const event = await ctx.utils.createTestEvent();

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments.$get({
                    param: { eventId: event.id },
                    query: {},
                });

                expect(res.status).toBe(200);
            },
            500_000,
        );

        integrationTest(
            "filters by status",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const event = await ctx.utils.createTestEvent();

                const a = await ctx.utils.createTestUser();
                const b = await ctx.utils.createTestUser();
                await ctx.db.insert(schema.eventPayment).values([
                    {
                        eventId: event.id,
                        userId: a.id,
                        amountMinor: 100,
                        status: "paid",
                    },
                    {
                        eventId: event.id,
                        userId: b.id,
                        amountMinor: 100,
                        status: "pending",
                    },
                ]);

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments.$get({
                    param: { eventId: event.id },
                    query: { status: "pending" },
                });

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.totalCount).toBe(1);
                expect(body.payments[0]?.userId).toBe(b.id);
                // The summary always covers the whole event, not the filter.
                expect(body.summary.paidCount).toBe(1);
                expect(body.summary.pendingCount).toBe(1);
            },
            500_000,
        );
    });

    describe("POST /:eventId/payments/:paymentId/refund", () => {
        async function seedPaidPayment(
            ctx: IntegrationTestContext,
            overrides: Partial<typeof schema.eventPayment.$inferInsert> = {},
        ) {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                isPaidEvent: true,
                priceMinor: 7500,
            });
            const payer = await ctx.utils.createTestUser();
            const [payment] = await ctx.db
                .insert(schema.eventPayment)
                .values({
                    eventId: event.id,
                    userId: payer.id,
                    amountMinor: 7500,
                    currency: "NOK",
                    provider: "vipps",
                    providerPaymentId: "vipps-ref-abc",
                    status: "paid",
                    ...overrides,
                })
                .returning();

            if (!payment) throw new Error("Failed to seed payment");
            return { event, payer, payment };
        }

        integrationTest(
            "refunds a paid payment and marks it refunded",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx);
                mockCaptured(7500);

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.status).toBe("refunded");
                expect(body.refundedAmountMinor).toBe(7500);

                expect(vi.mocked(vipps.refundPayment)).toHaveBeenCalledWith({
                    reference: "vipps-ref-abc",
                    amount: 7500,
                    currency: "NOK",
                });

                const row = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, payment.id),
                });
                expect(row?.status).toBe("refunded");
            },
            500_000,
        );

        integrationTest(
            "does not let the event creator refund without the permission",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                const creator = await ctx.utils.createTestUser();
                const event = await ctx.utils.createTestEvent({
                    isPaidEvent: true,
                    priceMinor: 7500,
                    createdByUserId: creator.id,
                });
                const [payment] = await ctx.db
                    .insert(schema.eventPayment)
                    .values({
                        eventId: event.id,
                        userId: creator.id,
                        amountMinor: 7500,
                        providerPaymentId: "ref",
                        status: "paid",
                    })
                    .returning();

                const client = await ctx.utils.clientForUser(creator);
                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment?.id ?? "" },
                });

                expect(res.status).toBe(403);
                expect(vi.mocked(vipps.refundPayment)).not.toHaveBeenCalled();
            },
            500_000,
        );

        integrationTest(
            "is idempotent — a second refund is a 409 and does not call the provider",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx, {
                    status: "refunded",
                });

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(409);
                expect(vi.mocked(vipps.refundPayment)).not.toHaveBeenCalled();
            },
            500_000,
        );

        integrationTest(
            "rejects a pending payment",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx, {
                    status: "pending",
                });

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(409);
            },
            500_000,
        );

        integrationTest(
            "rejects a payment that was never started with the provider",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx, {
                    providerPaymentId: null,
                });

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(409);
            },
            500_000,
        );

        integrationTest(
            "404s when the payment belongs to another event",
            async ({ ctx }) => {
                const { payment } = await seedPaidPayment(ctx);
                const otherEvent = await ctx.utils.createTestEvent();

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: {
                        eventId: otherEvent.id,
                        paymentId: payment.id,
                    },
                });

                expect(res.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "rolls the status back to paid when the provider fails",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx);
                mockCaptured(7500);
                vi.mocked(vipps.refundPayment).mockRejectedValueOnce(
                    new Error("Vipps sa nei"),
                );

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(502);

                const row = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, payment.id),
                });
                expect(row?.status).toBe("paid");
            },
            500_000,
        );

        integrationTest(
            "refuses to refund an uncaptured payment",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx);
                // Authorized but never captured — nothing to refund.
                vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
                    aggregate: {
                        authorizedAmount: { currency: "NOK", value: 7500 },
                        capturedAmount: { currency: "NOK", value: 0 },
                        refundedAmount: { currency: "NOK", value: 0 },
                        cancelledAmount: { currency: "NOK", value: 0 },
                    },
                } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(502);
                expect(vi.mocked(vipps.refundPayment)).not.toHaveBeenCalled();

                const row = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, payment.id),
                });
                expect(row?.status).toBe("paid");
            },
            500_000,
        );

        integrationTest(
            "refunds only the remaining amount on a partially refunded payment",
            async ({ ctx }) => {
                const { event, payment } = await seedPaidPayment(ctx);
                mockCaptured(7500, 2500);

                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, [
                    "events:payments:refund",
                ]);
                const client = await ctx.utils.clientForUser(admin);

                const res = await client.api.event[":eventId"].payments[
                    ":paymentId"
                ].refund.$post({
                    param: { eventId: event.id, paymentId: payment.id },
                });

                expect(res.status).toBe(200);
                expect(vi.mocked(vipps.refundPayment)).toHaveBeenCalledWith({
                    reference: "vipps-ref-abc",
                    amount: 5000,
                    currency: "NOK",
                });

                await ctx.db
                    .delete(schema.eventPayment)
                    .where(eq(schema.eventPayment.id, payment.id));
            },
            500_000,
        );
    });
});
