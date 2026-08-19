import { schema } from "@photon/db";
import { beforeEach, describe, expect, vi } from "vitest";
import * as vipps from "~/lib/vipps";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

// The confirmation asks Vipps what happened; stub the whole module. Every
// export the app imports must be present here — this factory *replaces* the
// module.
vi.mock("~/lib/vipps", () => ({
    buildPaymentDescription: vi.fn(() => "Test - Arrangement"),
    cancelPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    refundPayment: vi.fn().mockResolvedValue(undefined),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

const NO_AMOUNTS = {
    authorizedAmount: { currency: "NOK", value: 0 },
    capturedAmount: { currency: "NOK", value: 0 },
    refundedAmount: { currency: "NOK", value: 0 },
    cancelledAmount: { currency: "NOK", value: 0 },
};

/** Make the provider report the checkout in a given state. */
function mockVippsState(
    state: "CREATED" | "ABORTED" | "AUTHORIZED" | "EXPIRED",
    amounts: Partial<typeof NO_AMOUNTS> = {},
) {
    vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
        state,
        aggregate: { ...NO_AMOUNTS, ...amounts },
    } as unknown as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);
}

/**
 * A member who is registered for a paid event and has been sent to Vipps —
 * the state they are in the moment Vipps sends them back to us.
 */
async function seedCheckout(
    ctx: IntegrationTestContext,
    payment: Partial<{
        status: "pending" | "paid";
        providerPaymentId: string;
    }> = {},
) {
    await ctx.utils.setupEventCategories();
    const event = await ctx.utils.createTestEvent({
        capacity: 10,
        isPaidEvent: true,
        priceMinor: 10000,
    });
    const user = await ctx.utils.createTestUser();

    await ctx.db.insert(schema.eventRegistration).values({
        eventId: event.id,
        userId: user.id,
        status: "registered",
    });

    await ctx.db.insert(schema.eventPayment).values({
        eventId: event.id,
        userId: user.id,
        amountMinor: 10000,
        currency: "NOK",
        provider: "vipps",
        providerPaymentId: payment.providerPaymentId ?? "vipps-ref-returning",
        status: payment.status ?? "pending",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    return { event, user };
}

beforeEach(() => {
    vi.mocked(vipps.capturePayment).mockClear();
    vi.mocked(vipps.getPaymentDetails).mockClear();
});

describe("Confirming a payment on the way back from Vipps", () => {
    integrationTest(
        "records the payment the webhook has not delivered yet",
        async ({ ctx }) => {
            const { event, user } = await seedCheckout(ctx);
            mockVippsState("AUTHORIZED");

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[
                ":eventId"
            ].payment.confirm.$post({ param: { eventId: event.id } });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ status: "paid" });

            // AUTHORIZED only reserves the money, so confirming must capture it
            // — otherwise "paid" would mean a reservation that quietly expires.
            expect(vi.mocked(vipps.capturePayment)).toHaveBeenCalledWith({
                reference: "vipps-ref-returning",
                amount: 10000,
                currency: "NOK",
            });

            const rows = await ctx.db.query.eventPayment.findMany({
                where: (p, { eq }) => eq(p.eventId, event.id),
            });
            expect(rows[0]?.status).toBe("paid");
            expect(rows[0]?.receivedPaymentAt).not.toBeNull();

            // And the event now tells the member they have their spot.
            const eventRes = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            const body = await eventRes.json();
            // 404-svaret er en streng, så smalne typen inn før feltet leses.
            if (typeof body === "string") throw new Error(body);
            expect(body.registration?.hasPaid).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "answers 'pending' while the checkout is still open, without touching the payment",
        async ({ ctx }) => {
            const { event, user } = await seedCheckout(ctx);
            mockVippsState("CREATED");

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[
                ":eventId"
            ].payment.confirm.$post({ param: { eventId: event.id } });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ status: "pending" });

            const rows = await ctx.db.query.eventPayment.findMany({
                where: (p, { eq }) => eq(p.eventId, event.id),
            });
            expect(rows[0]?.status).toBe("pending");
        },
        500_000,
    );

    integrationTest(
        "answers 'pending' when Vipps cannot be reached, so the member is asked to wait rather than told it failed",
        async ({ ctx }) => {
            const { event, user } = await seedCheckout(ctx);
            vi.mocked(vipps.getPaymentDetails).mockRejectedValue(
                new Error("Vipps is down"),
            );

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[
                ":eventId"
            ].payment.confirm.$post({ param: { eventId: event.id } });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ status: "pending" });
        },
        500_000,
    );

    integrationTest(
        "answers 'failed' for a checkout the member aborted",
        async ({ ctx }) => {
            const { event, user } = await seedCheckout(ctx);
            mockVippsState("ABORTED");

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[
                ":eventId"
            ].payment.confirm.$post({ param: { eventId: event.id } });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ status: "failed" });
        },
        500_000,
    );

    integrationTest(
        "does not ask Vipps again about a payment the webhook already settled",
        async ({ ctx }) => {
            const { event, user } = await seedCheckout(ctx, { status: "paid" });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[
                ":eventId"
            ].payment.confirm.$post({ param: { eventId: event.id } });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ status: "paid" });
            expect(vi.mocked(vipps.getPaymentDetails)).not.toHaveBeenCalled();
        },
        500_000,
    );

    integrationTest(
        "requires a login",
        async ({ ctx }) => {
            const { event } = await seedCheckout(ctx);

            const res = await ctx.utils
                .client()
                .api.event[":eventId"].payment.confirm.$post({
                    param: { eventId: event.id },
                });

            expect(res.status).toBe(401);
        },
        500_000,
    );
});
