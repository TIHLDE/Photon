import { schema } from "@photon/db";
import { beforeEach, describe, expect, vi } from "vitest";
import * as vipps from "~/lib/vipps";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    // The signature check is exercised by vipps-webhook.test.ts; here we care
    // about what the handler does once a request is accepted.
    verifyVippsWebhookRequest: vi.fn().mockResolvedValue(true),
}));

function mockVippsState(
    state: "AUTHORIZED" | "TERMINATED" | "ABORTED" | "CREATED" | "EXPIRED",
    aggregate: { authorized: number; captured: number; refunded: number },
) {
    vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
        state,
        aggregate: {
            authorizedAmount: { currency: "NOK", value: aggregate.authorized },
            capturedAmount: { currency: "NOK", value: aggregate.captured },
            refundedAmount: { currency: "NOK", value: aggregate.refunded },
            cancelledAmount: { currency: "NOK", value: 0 },
        },
    } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);
}

async function seedPayment(
    ctx: IntegrationTestContext,
    overrides: Partial<typeof schema.eventPayment.$inferInsert> = {},
) {
    await ctx.utils.setupEventCategories();
    const event = await ctx.utils.createTestEvent({
        isPaidEvent: true,
        priceMinor: 10000,
    });
    const user = await ctx.utils.createTestUser();
    const [payment] = await ctx.db
        .insert(schema.eventPayment)
        .values({
            eventId: event.id,
            userId: user.id,
            amountMinor: 10000,
            currency: "NOK",
            provider: "vipps",
            providerPaymentId: "vipps-hook-ref",
            status: "pending",
            ...overrides,
        })
        .returning();

    if (!payment) throw new Error("Failed to seed payment");
    return { event, user, payment };
}

beforeEach(() => {
    vi.mocked(vipps.capturePayment).mockClear();
});

describe("Vipps webhook — capture and status mapping", () => {
    integrationTest(
        "captures an authorized payment and marks it paid",
        async ({ ctx }) => {
            const { payment } = await seedPayment(ctx);
            mockVippsState("AUTHORIZED", {
                authorized: 10000,
                captured: 0,
                refunded: 0,
            });

            const client = ctx.utils.client();
            const res = await client.api.event.payment.webhook.$post({
                json: { reference: "vipps-hook-ref" },
            });

            expect(res.status).toBe(200);
            expect(vi.mocked(vipps.capturePayment)).toHaveBeenCalledWith({
                reference: "vipps-hook-ref",
                amount: 10000,
                currency: "NOK",
            });

            const row = await ctx.db.query.eventPayment.findFirst({
                where: (p, { eq }) => eq(p.id, payment.id),
            });
            expect(row?.status).toBe("paid");
            expect(row?.receivedPaymentAt).not.toBeNull();
        },
        500_000,
    );

    integrationTest(
        "does not capture again when the amount is already captured",
        async ({ ctx }) => {
            await seedPayment(ctx);
            mockVippsState("AUTHORIZED", {
                authorized: 10000,
                captured: 10000,
                refunded: 0,
            });

            const client = ctx.utils.client();
            const res = await client.api.event.payment.webhook.$post({
                json: { reference: "vipps-hook-ref" },
            });

            expect(res.status).toBe(200);
            expect(vi.mocked(vipps.capturePayment)).not.toHaveBeenCalled();
        },
        500_000,
    );

    integrationTest(
        // A refunded payment still reports capturedAmount > 0, so without
        // checking refunds first a redelivered webhook flips it back to paid.
        "keeps a refunded payment refunded",
        async ({ ctx }) => {
            const { payment } = await seedPayment(ctx, { status: "refunded" });
            mockVippsState("TERMINATED", {
                authorized: 10000,
                captured: 10000,
                refunded: 10000,
            });

            const client = ctx.utils.client();
            const res = await client.api.event.payment.webhook.$post({
                json: { reference: "vipps-hook-ref" },
            });

            expect(res.status).toBe(200);
            const row = await ctx.db.query.eventPayment.findFirst({
                where: (p, { eq }) => eq(p.id, payment.id),
            });
            expect(row?.status).toBe("refunded");
        },
        500_000,
    );

    integrationTest(
        "does not move receivedPaymentAt on a redelivered webhook",
        async ({ ctx }) => {
            const stamped = new Date("2026-01-01T12:00:00.000Z");
            const { payment } = await seedPayment(ctx, {
                status: "paid",
                receivedPaymentAt: stamped,
            });
            mockVippsState("AUTHORIZED", {
                authorized: 10000,
                captured: 10000,
                refunded: 0,
            });

            const client = ctx.utils.client();
            await client.api.event.payment.webhook.$post({
                json: { reference: "vipps-hook-ref" },
            });

            const row = await ctx.db.query.eventPayment.findFirst({
                where: (p, { eq }) => eq(p.id, payment.id),
            });
            expect(row?.receivedPaymentAt?.toISOString()).toBe(
                stamped.toISOString(),
            );
        },
        500_000,
    );

    integrationTest(
        "marks an aborted payment as failed",
        async ({ ctx }) => {
            const { payment } = await seedPayment(ctx);
            mockVippsState("ABORTED", {
                authorized: 0,
                captured: 0,
                refunded: 0,
            });

            const client = ctx.utils.client();
            await client.api.event.payment.webhook.$post({
                json: { reference: "vipps-hook-ref" },
            });

            const row = await ctx.db.query.eventPayment.findFirst({
                where: (p, { eq }) => eq(p.id, payment.id),
            });
            expect(row?.status).toBe("failed");
            expect(vi.mocked(vipps.capturePayment)).not.toHaveBeenCalled();
        },
        500_000,
    );
});
