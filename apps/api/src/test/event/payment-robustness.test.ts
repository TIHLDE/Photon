import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { processEventNoShows } from "~/lib/event/no-show";
import { promoteFromWaitlist } from "~/lib/event/payment";
import { enforceExpiredPaymentDeadlines } from "~/lib/event/payment-sweep";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { sendNotification } from "~/lib/notification";
import * as vipps from "~/lib/vipps";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

vi.mock("~/lib/vipps", () => ({
    buildPaymentDescription: vi.fn(() => "Test - Arrangement"),
    cancelPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    refundPayment: vi.fn().mockResolvedValue(undefined),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn().mockResolvedValue(true),
}));

vi.mock("~/lib/notification", async (importOriginal) => {
    const actual = await importOriginal<typeof import("~/lib/notification")>();
    return { ...actual, sendNotification: vi.fn(actual.sendNotification) };
});

const HOUR = 60 * 60 * 1000;
const PRICE = 5000;

const NO_AMOUNTS = {
    authorizedAmount: { currency: "NOK", value: 0 },
    capturedAmount: { currency: "NOK", value: 0 },
    refundedAmount: { currency: "NOK", value: 0 },
    cancelledAmount: { currency: "NOK", value: 0 },
};

function mockVippsState(
    state: "CREATED" | "ABORTED" | "AUTHORIZED",
    amounts: Partial<typeof NO_AMOUNTS> = {},
) {
    vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
        state,
        aggregate: { ...NO_AMOUNTS, ...amounts },
    } as unknown as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);
}

beforeEach(() => {
    vi.mocked(vipps.cancelPayment).mockReset().mockResolvedValue(undefined);
    vi.mocked(vipps.capturePayment).mockClear();
    vi.mocked(vipps.createPayment).mockReset();
    vi.mocked(vipps.getPaymentDetails).mockReset();
    vi.mocked(vipps.refundPayment).mockReset().mockResolvedValue(undefined);
    mockVippsState("ABORTED");
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function paidEvent(ctx: IntegrationTestContext, capacity = 10) {
    await ctx.utils.setupEventCategories();
    return ctx.utils.createTestEvent({
        capacity,
        isPaidEvent: true,
        priceMinor: PRICE,
    });
}

async function holdSpot(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
    createdAt = new Date(Date.now() - 3 * HOUR),
) {
    await ctx.db.insert(schema.eventRegistration).values({
        eventId,
        userId,
        status: "registered",
        createdAt,
    });
}

async function addPayment(
    ctx: IntegrationTestContext,
    values: {
        eventId: string;
        userId: string;
        status: "pending" | "paid" | "failed" | "refunded";
        expiresAt?: Date | null;
        providerPaymentId?: string | null;
        createdAt?: Date;
    },
) {
    const [row] = await ctx.db
        .insert(schema.eventPayment)
        .values({
            amountMinor: PRICE,
            currency: "NOK",
            provider: values.providerPaymentId ? "vipps" : null,
            createdAt: new Date(Date.now() - 2 * HOUR),
            ...values,
        })
        .returning();
    if (!row) throw new Error("Failed to seed payment");
    return row;
}

async function endEvent(ctx: IntegrationTestContext, eventId: string) {
    await ctx.db
        .update(schema.event)
        .set({
            start: new Date(Date.now() - 5 * HOUR),
            end: new Date(Date.now() - 2 * HOUR),
        })
        .where(eq(schema.event.id, eventId));
}

async function registrationStatus(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    const row = await ctx.db.query.eventRegistration.findFirst({
        columns: { status: true },
        where: { eventId, userId },
    });
    return row?.status;
}

describe("sweep of failed obligations", () => {
    integrationTest(
        "reclaims the spot after an aborted checkout lost its timer, and promotes the waitlist",
        async ({ ctx }) => {
            const event = await paidEvent(ctx, 1);
            const member = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: waiting.id,
                status: "waitlisted",
                waitlistPosition: 1,
            });
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "failed",
                providerPaymentId: "aborted",
                expiresAt: new Date(Date.now() - 60_000),
            });

            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(1);

            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "cancelled",
            );
            expect(await registrationStatus(ctx, event.id, waiting.id)).toBe(
                "registered",
            );
            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(0);
        },
    );

    integrationTest(
        "reclaims through a chain where the last attempt has no deadline of its own",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "failed",
                providerPaymentId: "first",
                expiresAt: new Date(Date.now() - 60_000),
            });
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "failed",
                providerPaymentId: "second",
                expiresAt: null,
                createdAt: new Date(Date.now() - HOUR),
            });

            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(1);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "cancelled",
            );
        },
    );

    integrationTest(
        "extends once for a live retry, and then reclaims",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            const first = await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "failed",
                providerPaymentId: "first",
                expiresAt: new Date(Date.now() - 60_000),
            });
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                providerPaymentId: "retry",
                expiresAt: null,
                createdAt: new Date(Date.now() - HOUR),
            });
            mockVippsState("CREATED");

            await enforceExpiredPaymentDeadlines(ctx);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "registered",
            );
            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(0);

            await ctx.db
                .update(schema.eventPayment)
                .set({ expiresAt: new Date(Date.now() - 1000) })
                .where(eq(schema.eventPayment.id, first.id));

            await enforceExpiredPaymentDeadlines(ctx);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "cancelled",
            );
        },
    );

    type Scenario = {
        name: string;
        seed: (
            ctx: IntegrationTestContext,
            eventId: string,
            userId: string,
        ) => Promise<void>;
    };

    const overdueFailed = (eventId: string, userId: string) => ({
        eventId,
        userId,
        status: "failed" as const,
        providerPaymentId: "aborted",
        expiresAt: new Date(Date.now() - 60_000),
    });

    const scenarios: Scenario[] = [
        {
            name: "a deadline that is still running",
            seed: async (ctx, eventId, userId) => {
                await holdSpot(ctx, eventId, userId);
                await addPayment(ctx, {
                    ...overdueFailed(eventId, userId),
                    expiresAt: new Date(Date.now() + HOUR),
                });
            },
        },
        {
            name: "a later attempt that was paid",
            seed: async (ctx, eventId, userId) => {
                await holdSpot(ctx, eventId, userId);
                await addPayment(ctx, overdueFailed(eventId, userId));
                await addPayment(ctx, {
                    eventId,
                    userId,
                    status: "paid",
                    providerPaymentId: "paid",
                    createdAt: new Date(Date.now() - HOUR),
                });
            },
        },
        {
            name: "a later payment an organiser refunded without freeing the spot",
            seed: async (ctx, eventId, userId) => {
                await holdSpot(ctx, eventId, userId);
                await addPayment(ctx, overdueFailed(eventId, userId));
                await addPayment(ctx, {
                    eventId,
                    userId,
                    status: "refunded",
                    providerPaymentId: "refunded",
                    createdAt: new Date(Date.now() - HOUR),
                });
            },
        },
        {
            name: "an earlier payment an organiser refunded without freeing the spot",
            seed: async (ctx, eventId, userId) => {
                await holdSpot(ctx, eventId, userId);
                await addPayment(ctx, {
                    eventId,
                    userId,
                    status: "refunded",
                    providerPaymentId: "refunded",
                    createdAt: new Date(Date.now() - 2.5 * HOUR),
                });
                await addPayment(ctx, overdueFailed(eventId, userId));
            },
        },
        {
            name: "a newer obligation with its own live deadline",
            seed: async (ctx, eventId, userId) => {
                await holdSpot(ctx, eventId, userId);
                await addPayment(ctx, overdueFailed(eventId, userId));
                await addPayment(ctx, {
                    eventId,
                    userId,
                    status: "pending",
                    expiresAt: new Date(Date.now() + HOUR),
                    createdAt: new Date(Date.now() - HOUR),
                });
            },
        },
        {
            name: "a failed row from before the current registration",
            seed: async (ctx, eventId, userId) => {
                await holdSpot(ctx, eventId, userId, new Date());
                await addPayment(ctx, overdueFailed(eventId, userId));
            },
        },
    ];

    for (const scenario of scenarios) {
        integrationTest(`leaves ${scenario.name} alone`, async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await scenario.seed(ctx, event.id, member.id);

            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(0);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "registered",
            );
        });
    }

    integrationTest(
        "asks Vipps about the failed row itself, and keeps the seat if money is there",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            const row = await addPayment(
                ctx,
                overdueFailed(event.id, member.id),
            );
            mockVippsState("AUTHORIZED", {
                authorizedAmount: { currency: "NOK", value: PRICE },
            });

            await enforceExpiredPaymentDeadlines(ctx);

            expect(vipps.getPaymentDetails).toHaveBeenCalledWith("aborted");
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "registered",
            );
            const after = await ctx.db.query.eventPayment.findFirst({
                where: { id: row.id },
            });
            expect(after?.status).toBe("paid");
        },
    );

    integrationTest(
        "a refund from an earlier sign-up does not protect the new one",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "refunded",
                providerPaymentId: "refunded",
                createdAt: new Date(Date.now() - 24 * HOUR),
            });
            await addPayment(ctx, overdueFailed(event.id, member.id));

            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(1);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "cancelled",
            );
        },
    );

    integrationTest(
        "leaves an event that has started alone",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, overdueFailed(event.id, member.id));
            await ctx.db
                .update(schema.event)
                .set({
                    start: new Date(Date.now() - HOUR),
                    end: new Date(Date.now() + HOUR),
                })
                .where(eq(schema.event.id, event.id));

            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(0);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "registered",
            );
        },
    );

    integrationTest("leaves an event that has ended alone", async ({ ctx }) => {
        const event = await paidEvent(ctx);
        const member = await ctx.utils.createTestUser();
        await holdSpot(ctx, event.id, member.id);
        await addPayment(ctx, overdueFailed(event.id, member.id));
        await endEvent(ctx, event.id);

        expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(0);
        expect(await registrationStatus(ctx, event.id, member.id)).toBe(
            "registered",
        );
    });

    integrationTest(
        "leaves an event that is no longer paid alone",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, overdueFailed(event.id, member.id));
            await ctx.db
                .update(schema.event)
                .set({ isPaidEvent: false })
                .where(eq(schema.event.id, event.id));

            expect(await enforceExpiredPaymentDeadlines(ctx)).toBe(0);
            expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                "registered",
            );
        },
    );
});

describe("webhook for a reference no payment holds", () => {
    const deliver = (ctx: IntegrationTestContext, reference: string) =>
        ctx.app.request("/api/event/payment/webhook", {
            method: "POST",
            body: JSON.stringify({ reference }),
        });

    integrationTest(
        "acknowledges it and still reads the state from Vipps",
        async ({ ctx }) => {
            mockVippsState("ABORTED");

            const res = await deliver(ctx, "replaced");

            expect(res.status).toBe(200);
            expect(vipps.getPaymentDetails).toHaveBeenCalledWith("replaced");
        },
    );

    integrationTest(
        "marks nothing paid and captures nothing, but reports money on it",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            const current = await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                providerPaymentId: "current",
                expiresAt: new Date(Date.now() + HOUR),
            });
            mockVippsState("AUTHORIZED", {
                authorizedAmount: { currency: "NOK", value: PRICE },
            });
            const logged = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            const res = await deliver(ctx, "replaced");

            expect(res.status).toBe(200);
            expect(vipps.capturePayment).not.toHaveBeenCalled();
            expect(logged).toHaveBeenCalledWith(
                expect.stringContaining("replaced"),
            );
            const after = await ctx.db.query.eventPayment.findFirst({
                where: { id: current.id },
            });
            expect(after?.status).toBe("pending");
        },
    );

    integrationTest(
        "does not ask for a retry when Vipps cannot be reached",
        async ({ ctx }) => {
            vi.mocked(vipps.getPaymentDetails).mockRejectedValue(
                new Error("down"),
            );
            vi.spyOn(console, "error").mockImplementation(() => {});

            expect((await deliver(ctx, "replaced")).status).toBe(200);
        },
    );

    integrationTest(
        "an answer about an old checkout does not touch the one that replaced it",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            const row = await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                providerPaymentId: "old",
                expiresAt: new Date(Date.now() + HOUR),
            });
            vi.mocked(vipps.getPaymentDetails).mockImplementation(async () => {
                await ctx.db
                    .update(schema.eventPayment)
                    .set({ providerPaymentId: "new" })
                    .where(eq(schema.eventPayment.id, row.id));
                return {
                    state: "ABORTED",
                    aggregate: NO_AMOUNTS,
                } as unknown as Awaited<
                    ReturnType<typeof vipps.getPaymentDetails>
                >;
            });

            expect((await deliver(ctx, "old")).status).toBe(200);

            const after = await ctx.db.query.eventPayment.findFirst({
                where: { id: row.id },
            });
            expect(after?.status).toBe("pending");
            expect(after?.providerPaymentId).toBe("new");
        },
    );

    integrationTest("still rejects an unsigned request", async ({ ctx }) => {
        vi.mocked(vipps.verifyVippsWebhookRequest).mockResolvedValueOnce(false);

        expect((await deliver(ctx, "replaced")).status).toBe(401);
        expect(vipps.getPaymentDetails).not.toHaveBeenCalled();
    });
});

describe("creating a payment", () => {
    function barrierOnCreate(expectedCalls: number) {
        let calls = 0;
        let release: () => void = () => {};
        const reached = new Promise<void>((resolve) => {
            release = resolve;
        });
        vi.mocked(vipps.createPayment).mockImplementation(async () => {
            calls += 1;
            const url = `https://vipps.test/${calls}`;
            if (calls === expectedCalls) release();
            await reached;
            return url;
        });
    }

    const pressPay = async (
        ctx: IntegrationTestContext,
        user: Awaited<
            ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
        >,
        eventId: string,
    ) => {
        const client = await ctx.utils.clientForUser(user);
        return client.api.event[":eventId"].payment.$post({
            param: { eventId },
            json: {
                returnUrl: "https://tihlde.org/arrangementer/test",
                userFlow: "WEB_REDIRECT",
            },
        });
    };

    const referencesSentToVipps = () =>
        vi.mocked(vipps.createPayment).mock.calls.map((c) => c[0].reference);

    integrationTest(
        "two presses on one obligation leave one payable checkout",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                expiresAt: new Date(Date.now() + HOUR),
            });
            barrierOnCreate(2);

            const responses = await Promise.all([
                pressPay(ctx, member, event.id),
                pressPay(ctx, member, event.id),
            ]);

            expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);

            const rows = await ctx.db.query.eventPayment.findMany({
                where: { eventId: event.id, userId: member.id },
            });
            expect(rows).toHaveLength(1);

            const [first, second] = referencesSentToVipps();
            const winner = rows[0]?.providerPaymentId;
            expect([first, second]).toContain(winner);
            const loser = winner === first ? second : first;
            expect(vipps.cancelPayment).toHaveBeenCalledTimes(1);
            expect(vipps.cancelPayment).toHaveBeenCalledWith(loser);
        },
    );

    integrationTest(
        "two presses with no obligation to reuse create one row",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            barrierOnCreate(2);

            const responses = await Promise.all([
                pressPay(ctx, member, event.id),
                pressPay(ctx, member, event.id),
            ]);

            expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
            const rows = await ctx.db.query.eventPayment.findMany({
                where: { eventId: event.id, userId: member.id },
            });
            expect(rows).toHaveLength(1);
            expect(vipps.cancelPayment).toHaveBeenCalledTimes(1);
        },
    );

    integrationTest(
        "cancels the checkout when the spot is gone by the time it is attached",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                expiresAt: new Date(Date.now() + HOUR),
            });
            vi.mocked(vipps.createPayment).mockImplementation(async () => {
                await ctx.db
                    .update(schema.eventRegistration)
                    .set({ status: "cancelled" })
                    .where(eq(schema.eventRegistration.userId, member.id));
                return "https://vipps.test/late";
            });

            const res = await pressPay(ctx, member, event.id);

            expect(res.status).toBe(404);
            expect(await res.text()).toContain(
                "You must register for the event before paying",
            );
            expect(vipps.cancelPayment).toHaveBeenCalledWith(
                referencesSentToVipps()[0],
            );
        },
    );

    integrationTest(
        "says already paid when the money landed during the Vipps call",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            vi.mocked(vipps.createPayment).mockImplementation(async () => {
                await addPayment(ctx, {
                    eventId: event.id,
                    userId: member.id,
                    status: "paid",
                    providerPaymentId: "settled",
                });
                return "https://vipps.test/late";
            });

            const res = await pressPay(ctx, member, event.id);

            expect(res.status).toBe(409);
            expect(await res.text()).toContain("already paid");
            expect(vipps.cancelPayment).toHaveBeenCalledWith(
                referencesSentToVipps()[0],
            );
        },
    );

    integrationTest(
        "a sequential restart still replaces the reference",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            const started = await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                providerPaymentId: "walked-away",
                expiresAt: new Date(Date.now() + HOUR),
            });
            mockVippsState("CREATED");
            vi.mocked(vipps.createPayment).mockResolvedValue(
                "https://vipps.test/new",
            );

            const res = await pressPay(ctx, member, event.id);

            expect(res.status).toBe(201);
            const after = await ctx.db.query.eventPayment.findFirst({
                where: { id: started.id },
            });
            expect(after?.providerPaymentId).toBe(referencesSentToVipps()[0]);
            expect(vipps.cancelPayment).toHaveBeenCalledWith("walked-away");
        },
    );

    integrationTest(
        "keeps the error the card already understands when Vipps fails",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            vi.mocked(vipps.createPayment).mockRejectedValue(new Error("down"));

            const res = await pressPay(ctx, member, event.id);

            expect(res.status).toBe(500);
            expect(await res.text()).toContain(
                "Failed to initiate Vipps payment",
            );
        },
    );

    integrationTest(
        "stops calling Vipps after ten attempts, per member",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await holdSpot(ctx, event.id, other.id);
            vi.mocked(vipps.createPayment).mockRejectedValue(new Error("down"));

            for (let attempt = 0; attempt < 10; attempt += 1) {
                expect((await pressPay(ctx, member, event.id)).status).toBe(
                    500,
                );
            }
            vi.mocked(vipps.createPayment).mockClear();

            expect((await pressPay(ctx, member, event.id)).status).toBe(429);
            expect(vipps.createPayment).not.toHaveBeenCalled();
            expect((await pressPay(ctx, other, event.id)).status).toBe(500);
        },
    );

    integrationTest(
        "does not let a broken counter stop a payment",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            vi.mocked(vipps.createPayment).mockResolvedValue(
                "https://vipps.test/ok",
            );
            vi.spyOn(console, "error").mockImplementation(() => {});
            const client = await ctx.utils.clientForUser(member);
            const getString = ctx.cache.getString.bind(ctx.cache);
            vi.spyOn(ctx.cache, "getString").mockImplementation(async (key) => {
                if (key.startsWith("ratelimit:event-payment")) {
                    throw new Error("redis down");
                }
                return getString(key);
            });

            const res = await client.api.event[":eventId"].payment.$post({
                param: { eventId: event.id },
                json: {
                    returnUrl: "https://tihlde.org/arrangementer/test",
                    userFlow: "WEB_REDIRECT",
                },
            });

            expect(res.status).toBe(201);
            expect(vipps.createPayment).toHaveBeenCalledTimes(1);
        },
    );
});

describe("deleting an event", () => {
    async function seedOwnedEvent(ctx: IntegrationTestContext) {
        await ctx.utils.setupEventCategories();
        const creator = await ctx.utils.createTestUser();
        const payer = await ctx.utils.createTestUser();
        const event = await ctx.utils.createTestEvent({
            capacity: 10,
            isPaidEvent: true,
            priceMinor: PRICE,
            createdByUserId: creator.id,
        });
        return { creator, payer, event };
    }

    const refusals = [
        { status: "paid", providerPaymentId: "paid" },
        { status: "refunded", providerPaymentId: "refunded" },
        { status: "pending", providerPaymentId: "open-checkout" },
    ] as const;

    for (const payment of refusals) {
        integrationTest(
            `refuses with a ${payment.status} payment and keeps the row`,
            async ({ ctx }) => {
                const { creator, payer, event } = await seedOwnedEvent(ctx);
                const row = await addPayment(ctx, {
                    eventId: event.id,
                    userId: payer.id,
                    ...payment,
                });

                const client = await ctx.utils.clientForUser(creator);
                const res = await client.api.event[":eventId"].$delete({
                    param: { eventId: event.id },
                });

                expect(res.status).toBe(409);
                expect(
                    await ctx.db.query.eventPayment.findFirst({
                        where: { id: row.id },
                    }),
                ).toBeDefined();
                expect(
                    await ctx.db.query.event.findFirst({
                        where: { id: event.id },
                    }),
                ).toBeDefined();
            },
        );
    }

    integrationTest(
        "still lets an organiser delete a test event where no money moved",
        async ({ ctx }) => {
            const { creator, payer, event } = await seedOwnedEvent(ctx);
            const other = await ctx.utils.createTestUser();
            await addPayment(ctx, {
                eventId: event.id,
                userId: payer.id,
                status: "pending",
                expiresAt: new Date(Date.now() + HOUR),
            });
            await addPayment(ctx, {
                eventId: event.id,
                userId: other.id,
                status: "failed",
                providerPaymentId: "aborted",
            });

            const client = await ctx.utils.clientForUser(creator);
            const res = await client.api.event[":eventId"].$delete({
                param: { eventId: event.id },
            });

            expect(res.status).toBe(200);
            expect(
                await ctx.db.query.event.findFirst({ where: { id: event.id } }),
            ).toBeUndefined();
        },
    );
});

describe("refund record", () => {
    async function seedRefund(ctx: IntegrationTestContext) {
        const event = await paidEvent(ctx);
        const member = await ctx.utils.createTestUser();
        const organiser = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(organiser, [
            "events:payments:refund",
        ]);
        const row = await addPayment(ctx, {
            eventId: event.id,
            userId: member.id,
            status: "paid",
            providerPaymentId: "paid",
        });
        const client = await ctx.utils.clientForUser(organiser);
        const refund = () =>
            client.api.event[":eventId"].payments[":paymentId"].refund.$post({
                param: { eventId: event.id, paymentId: row.id },
            });
        return { row, refund };
    }

    const details = (refunded: number) =>
        ({
            state: "AUTHORIZED",
            aggregate: {
                ...NO_AMOUNTS,
                capturedAmount: { currency: "NOK", value: PRICE },
                refundedAmount: { currency: "NOK", value: refunded },
            },
        }) as unknown as Awaited<ReturnType<typeof vipps.getPaymentDetails>>;

    integrationTest(
        "stays refunded when the call fails after the money left",
        async ({ ctx }) => {
            const { row, refund } = await seedRefund(ctx);
            vi.mocked(vipps.getPaymentDetails)
                .mockResolvedValueOnce(details(0))
                .mockResolvedValueOnce(details(PRICE));
            vi.mocked(vipps.refundPayment).mockRejectedValue(
                new Error("timeout"),
            );
            vi.spyOn(console, "warn").mockImplementation(() => {});

            expect((await refund()).status).toBe(409);

            const after = await ctx.db.query.eventPayment.findFirst({
                where: { id: row.id },
            });
            expect(after?.status).toBe("refunded");
        },
    );

    integrationTest("goes back to paid when no money left", async ({ ctx }) => {
        const { row, refund } = await seedRefund(ctx);
        vi.mocked(vipps.getPaymentDetails).mockResolvedValue(details(0));
        vi.mocked(vipps.refundPayment).mockRejectedValue(new Error("rejected"));

        expect((await refund()).status).toBe(502);

        const after = await ctx.db.query.eventPayment.findFirst({
            where: { id: row.id },
        });
        expect(after?.status).toBe("paid");
    });

    integrationTest(
        "stays refunded when the notice to the member fails",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            const organiser = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organiser, [
                "events:payments:refund",
            ]);
            const row = await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "paid",
                providerPaymentId: "paid",
            });
            mockVippsState("AUTHORIZED", {
                capturedAmount: { currency: "NOK", value: PRICE },
            });
            vi.mocked(sendNotification).mockRejectedValueOnce(
                new Error("queue down"),
            );
            vi.spyOn(console, "error").mockImplementation(() => {});

            const client = await ctx.utils.clientForUser(organiser);
            const res = await client.api.event[":eventId"].payments[
                ":paymentId"
            ].refund.$post({
                param: { eventId: event.id, paymentId: row.id },
            });

            expect(res.status).toBe(200);
            expect(vipps.refundPayment).toHaveBeenCalledTimes(1);
            const after = await ctx.db.query.eventPayment.findFirst({
                where: { id: row.id },
            });
            expect(after?.status).toBe("refunded");
        },
    );
});

describe("unregistering after the event has ended", () => {
    async function endedStrikeEvent(ctx: IntegrationTestContext) {
        await ctx.utils.setupEventCategories();
        const event = await ctx.utils.createTestEvent({
            capacity: 5,
            canCauseStrikes: true,
        });
        await ctx.db
            .update(schema.event)
            .set({ cancellationDeadline: new Date(Date.now() - 24 * HOUR) })
            .where(eq(schema.event.id, event.id));
        await endEvent(ctx, event.id);
        return event;
    }

    const unregister = async (
        ctx: IntegrationTestContext,
        user: Awaited<
            ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
        >,
        eventId: string,
    ) => {
        const client = await ctx.utils.clientForUser(user);
        return client.api.event[":eventId"].registration.$delete({
            param: { eventId },
        });
    };

    integrationTest(
        "a no-show cannot trade two strikes for one or promote the waitlist",
        async ({ ctx }) => {
            const event = await endedStrikeEvent(ctx);
            const attended = await ctx.utils.createTestUser();
            const skipper = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values([
                { eventId: event.id, userId: attended.id, status: "attended" },
                { eventId: event.id, userId: skipper.id, status: "registered" },
                {
                    eventId: event.id,
                    userId: waiting.id,
                    status: "waitlisted",
                    waitlistPosition: 1,
                },
            ]);

            const res = await unregister(ctx, skipper, event.id);

            expect(res.status).toBe(400);
            expect(await registrationStatus(ctx, event.id, waiting.id)).toBe(
                "waitlisted",
            );

            await processEventNoShows(event.id, ctx);
            const strikes = await ctx.db.query.eventStrike.findMany({
                where: { eventId: event.id, userId: skipper.id },
            });
            expect(strikes.reduce((sum, s) => sum + s.count, 0)).toBe(2);
        },
    );

    for (const status of ["attended", "no_show"] as const) {
        integrationTest(
            `an ${status} record cannot be erased`,
            async ({ ctx }) => {
                const event = await endedStrikeEvent(ctx);
                const member = await ctx.utils.createTestUser();
                await ctx.db
                    .insert(schema.eventRegistration)
                    .values({ eventId: event.id, userId: member.id, status });

                const res = await unregister(ctx, member, event.id);

                expect(res.status).toBe(400);
                expect(await registrationStatus(ctx, event.id, member.id)).toBe(
                    status,
                );
            },
        );
    }

    integrationTest(
        "leaves an open checkout alone when it refuses",
        async ({ ctx }) => {
            const event = await paidEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await holdSpot(ctx, event.id, member.id);
            await addPayment(ctx, {
                eventId: event.id,
                userId: member.id,
                status: "pending",
                providerPaymentId: "open",
                expiresAt: new Date(Date.now() + HOUR),
            });
            await endEvent(ctx, event.id);

            const res = await unregister(ctx, member, event.id);

            expect(res.status).toBe(400);
            expect(vipps.cancelPayment).not.toHaveBeenCalled();
        },
    );

    integrationTest(
        "a member can still leave the waitlist",
        async ({ ctx }) => {
            const event = await endedStrikeEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "waitlisted",
                waitlistPosition: 1,
            });

            expect((await unregister(ctx, member, event.id)).status).toBe(200);
        },
    );

    integrationTest(
        "unregistering before the end still works and earns the late strike",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                capacity: 5,
                canCauseStrikes: true,
            });
            await ctx.db
                .update(schema.event)
                .set({
                    start: new Date(Date.now() - HOUR),
                    end: new Date(Date.now() + HOUR),
                    cancellationDeadline: new Date(Date.now() - 24 * HOUR),
                })
                .where(eq(schema.event.id, event.id));
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: member.id,
                status: "registered",
            });

            expect((await unregister(ctx, member, event.id)).status).toBe(200);
            const strikes = await ctx.db.query.eventStrike.findMany({
                where: { eventId: event.id, userId: member.id },
            });
            expect(strikes.reduce((sum, s) => sum + s.count, 0)).toBe(1);
        },
    );
});

describe("capacity counts everyone holding a seat", () => {
    integrationTest(
        "a checked-in member keeps their seat from the resolver",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({ capacity: 1 });
            const attended = await ctx.utils.createTestUser();
            const late = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: attended.id,
                status: "attended",
            });
            await ctx.utils.createPendingRegistration(event.id, late.id);

            await resolveRegistrationsForEvent(event.id, ctx);

            expect(await registrationStatus(ctx, event.id, late.id)).toBe(
                "waitlisted",
            );
        },
    );

    integrationTest(
        "a checked-in member keeps their seat from a waitlist promotion",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({ capacity: 1 });
            const attended = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values([
                { eventId: event.id, userId: attended.id, status: "attended" },
                {
                    eventId: event.id,
                    userId: waiting.id,
                    status: "waitlisted",
                    waitlistPosition: 1,
                },
            ]);
            const loaded = await ctx.db.query.event.findFirst({
                where: { id: event.id },
                with: { pools: true, priorityUsers: true },
            });
            if (!loaded) throw new Error("Event not found");

            expect(await promoteFromWaitlist(ctx, loaded)).toBe(false);
            expect(await registrationStatus(ctx, event.id, waiting.id)).toBe(
                "waitlisted",
            );
        },
    );

    integrationTest(
        "a seat that really is free still goes to the waitlist",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({ capacity: 2 });
            const attended = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values([
                { eventId: event.id, userId: attended.id, status: "attended" },
                {
                    eventId: event.id,
                    userId: waiting.id,
                    status: "waitlisted",
                    waitlistPosition: 1,
                },
            ]);
            const loaded = await ctx.db.query.event.findFirst({
                where: { id: event.id },
                with: { pools: true, priorityUsers: true },
            });
            if (!loaded) throw new Error("Event not found");

            expect(await promoteFromWaitlist(ctx, loaded)).toBe(true);
            expect(await registrationStatus(ctx, event.id, waiting.id)).toBe(
                "registered",
            );
        },
    );
});
