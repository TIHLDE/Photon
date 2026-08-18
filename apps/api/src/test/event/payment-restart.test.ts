import { schema } from "@photon/db";
import { beforeEach, describe, expect, vi } from "vitest";
import * as vipps from "~/lib/vipps";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

// The checkout talks to Vipps; stub the whole module. Every export the app
// imports must be present here — this factory *replaces* the module.
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

/** Make the provider report an existing checkout in a given state. */
function mockVippsState(
    state: "CREATED" | "ABORTED" | "AUTHORIZED",
    amounts: Partial<typeof NO_AMOUNTS> = {},
) {
    vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
        state,
        aggregate: { ...NO_AMOUNTS, ...amounts },
    } as unknown as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);
}

/**
 * A member who is registered for a paid event and has already been sent to
 * Vipps once — the state you are in the moment you press the browser's back
 * button on the checkout page.
 */
async function seedStartedCheckout(ctx: IntegrationTestContext) {
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

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const [payment] = await ctx.db
        .insert(schema.eventPayment)
        .values({
            eventId: event.id,
            userId: user.id,
            amountMinor: 10000,
            currency: "NOK",
            provider: "vipps",
            providerPaymentId: "vipps-ref-abandoned",
            status: "pending",
            expiresAt,
        })
        .returning();

    if (!payment) throw new Error("Failed to seed payment");
    return { event, user, payment, expiresAt };
}

beforeEach(() => {
    vi.mocked(vipps.cancelPayment).mockClear();
    vi.mocked(vipps.createPayment).mockClear();
    vi.mocked(vipps.getPaymentDetails).mockClear();
});

describe("Restarting an abandoned Vipps checkout", () => {
    integrationTest(
        "cancels the checkout the member walked away from and hands out a new one",
        async ({ ctx }) => {
            const { event, user, payment, expiresAt } =
                await seedStartedCheckout(ctx);
            mockVippsState("CREATED");
            vi.mocked(vipps.createPayment).mockResolvedValue(
                "https://vipps.test/checkout-2",
            );

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].payment.$post({
                param: { eventId: event.id },
                json: {
                    returnUrl: "https://tihlde.org/arrangementer/test",
                    userFlow: "WEB_REDIRECT",
                },
            });

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.checkoutUrl).toBe("https://vipps.test/checkout-2");

            expect(vi.mocked(vipps.cancelPayment)).toHaveBeenCalledWith(
                "vipps-ref-abandoned",
            );

            // The obligation row is reused, so the payment deadline the member
            // sees keeps counting down instead of restarting.
            const rows = await ctx.db.query.eventPayment.findMany({
                where: (p, { eq }) => eq(p.eventId, event.id),
            });
            expect(rows).toHaveLength(1);
            expect(rows[0]?.id).toBe(payment.id);
            expect(rows[0]?.providerPaymentId).not.toBe("vipps-ref-abandoned");
            expect(rows[0]?.expiresAt?.getTime()).toBe(expiresAt.getTime());
        },
        500_000,
    );

    integrationTest(
        "does not cancel a checkout the member actually paid",
        async ({ ctx }) => {
            const { event, user } = await seedStartedCheckout(ctx);
            mockVippsState("AUTHORIZED", {
                authorizedAmount: { currency: "NOK", value: 10000 },
            });

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].payment.$post({
                param: { eventId: event.id },
                json: {
                    returnUrl: "https://tihlde.org/arrangementer/test",
                    userFlow: "WEB_REDIRECT",
                },
            });

            expect(res.status).toBe(409);
            expect(vi.mocked(vipps.cancelPayment)).not.toHaveBeenCalled();
            expect(vi.mocked(vipps.createPayment)).not.toHaveBeenCalled();
        },
        500_000,
    );

    integrationTest(
        "keeps blocking when Vipps cannot say what happened to the checkout",
        async ({ ctx }) => {
            const { event, user } = await seedStartedCheckout(ctx);
            vi.mocked(vipps.getPaymentDetails).mockRejectedValue(
                new Error("Vipps is down"),
            );

            const client = await ctx.utils.clientForUser(user);
            const res = await client.api.event[":eventId"].payment.$post({
                param: { eventId: event.id },
                json: {
                    returnUrl: "https://tihlde.org/arrangementer/test",
                    userFlow: "WEB_REDIRECT",
                },
            });

            expect(res.status).toBe(409);
            expect(vi.mocked(vipps.createPayment)).not.toHaveBeenCalled();
        },
        500_000,
    );
});
