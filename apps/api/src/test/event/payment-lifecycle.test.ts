import { PAYMENT_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import type { PaymentTimerJobData } from "~/lib/event/payment";
import { handlePaymentExpiration } from "~/lib/event/payment";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import * as vipps from "~/lib/vipps";
import { integrationTest } from "~/test/config/integration";

// The refund path talks to Vipps; stub the whole module so the lifecycle can be
// exercised without a live payment processor.
vi.mock("~/lib/vipps", () => ({
    refundPayment: vi.fn().mockResolvedValue(undefined),
    capturePayment: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn(),
    getPaymentDetails: vi.fn(),
    setupWebhooks: vi.fn(),
    verifyVippsWebhookRequest: vi.fn(),
}));

const GRACE_MINUTES = 30;

async function getPaymentTimerJobs(ctx: {
    queue: {
        getQueue: (name: "payment") => { getJobs: () => Promise<unknown[]> };
    };
}) {
    return (await ctx.queue.getQueue(PAYMENT_QUEUE_NAME).getJobs()) as Array<{
        name: string;
        data: PaymentTimerJobData;
        delay?: number;
    }>;
}

describe("Paid event payment lifecycle", () => {
    describe("Hull A — obligation + timer on registration", () => {
        integrationTest(
            "creates a pending payment and schedules the countdown timer",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 10,
                    isPaidEvent: true,
                    priceMinor: 10000,
                    paymentGracePeriodMinutes: GRACE_MINUTES,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);

                const before = Date.now();
                await resolveRegistrationsForEvent(event.id, ctx);
                const after = Date.now();

                const registration =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (r, { and, eq }) =>
                            and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                    });
                expect(registration?.status).toBe("registered");

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });
                expect(payment).toBeDefined();
                expect(payment?.status).toBe("pending");
                expect(payment?.amountMinor).toBe(10000);
                expect(payment?.providerPaymentId).toBeNull();

                // Expiration should be roughly now + grace period.
                const expiresAt = payment?.expiresAt?.getTime() ?? 0;
                expect(expiresAt).toBeGreaterThanOrEqual(
                    before + GRACE_MINUTES * 60 * 1000,
                );
                expect(expiresAt).toBeLessThanOrEqual(
                    after + GRACE_MINUTES * 60 * 1000 + 1000,
                );

                // A delayed timer job pointing at this payment should be queued.
                const jobs = await getPaymentTimerJobs(ctx);
                expect(jobs).toHaveLength(1);
                expect(jobs[0]?.name).toBe("payment-expiration");
                expect(jobs[0]?.data.paymentId).toBe(payment?.id);
                expect(jobs[0]?.data.userId).toBe(user.id);
                expect(jobs[0]?.delay).toBe(GRACE_MINUTES * 60 * 1000);
            },
            500_000,
        );

        integrationTest(
            "does not create an obligation for a free event",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 10,
                    isPaidEvent: false,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const payments = await ctx.db.query.eventPayment.findMany({
                    where: (p, { eq }) => eq(p.eventId, event.id),
                });
                expect(payments).toHaveLength(0);

                const jobs = await getPaymentTimerJobs(ctx);
                expect(jobs).toHaveLength(0);
            },
            500_000,
        );
    });

    describe("Timer expiry — reclaim unpaid spot", () => {
        integrationTest(
            "cancels the unpaid user and promotes the waitlist",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                    paymentGracePeriodMinutes: GRACE_MINUTES,
                });

                const user1 = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user1.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                await new Promise((resolve) => setTimeout(resolve, 10));

                const user2Data = await ctx.auth.api.createUser({
                    body: {
                        email: "waitlisted@test.com",
                        name: "Waitlisted User",
                        password: "test123!",
                    },
                });
                const user2 = user2Data.user;
                await ctx.utils.createPendingRegistration(event.id, user2.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                // user1 registered (with obligation), user2 waitlisted.
                const payment1 = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user1.id)),
                });
                expect(payment1?.status).toBe("pending");

                const waitReg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user2.id)),
                });
                expect(waitReg?.status).toBe("waitlisted");

                // Fire the timer for user1's unpaid obligation.
                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user1.id,
                    paymentId: payment1?.id ?? "",
                });

                // user1 is cancelled, obligation failed.
                const reg1 = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user1.id)),
                });
                expect(reg1?.status).toBe("cancelled");

                const failedPayment = await ctx.db.query.eventPayment.findFirst(
                    {
                        where: (p, { eq }) => eq(p.id, payment1?.id ?? ""),
                    },
                );
                expect(failedPayment?.status).toBe("failed");

                // user2 promoted into the freed spot, with their own obligation.
                const reg2 = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user2.id)),
                });
                expect(reg2?.status).toBe("registered");
                expect(reg2?.waitlistPosition).toBeNull();

                const payment2 = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(
                            eq(p.eventId, event.id),
                            eq(p.userId, user2.id),
                            eq(p.status, "pending"),
                        ),
                });
                expect(payment2).toBeDefined();
            },
            500_000,
        );

        integrationTest(
            "keeps the spot when the user has already paid",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                    paymentGracePeriodMinutes: GRACE_MINUTES,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });

                // Mark as paid before the timer fires.
                await ctx.db
                    .update(schema.eventPayment)
                    .set({ status: "paid", receivedPaymentAt: new Date() })
                    .where(eq(schema.eventPayment.id, payment?.id ?? ""));

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: payment?.id ?? "",
                });

                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                });
                expect(reg?.status).toBe("registered");
            },
            500_000,
        );
    });

    describe("Hull B — refund on swap", () => {
        integrationTest(
            "refunds a paid user who is swapped to the waitlist",
            async ({ ctx }) => {
                const refundMock = vi.mocked(vipps.refundPayment);
                refundMock.mockClear();

                // The refund amount is read back from the provider, so the
                // payment must look fully captured and not yet refunded.
                vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
                    aggregate: {
                        authorizedAmount: { currency: "NOK", value: 7500 },
                        capturedAmount: { currency: "NOK", value: 7500 },
                        refundedAmount: { currency: "NOK", value: 0 },
                        cancelledAmount: { currency: "NOK", value: 0 },
                    },
                } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);

                await ctx.utils.setupEventCategories();
                await ctx.utils.setupGroups();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 7500,
                    paymentGracePeriodMinutes: GRACE_MINUTES,
                });

                // Priority pool requiring "index" membership.
                const [pool] = await ctx.db
                    .insert(schema.eventPriorityPool)
                    .values({ eventId: event.id, priorityScore: 1 })
                    .returning();
                if (!pool) {
                    throw new Error("Failed to create priority pool");
                }
                await ctx.db.insert(schema.eventPriorityPoolGroup).values({
                    priorityPoolId: pool.id,
                    groupSlug: "index",
                });

                // Non-prioritized user grabs the single spot first.
                const nonPrioritized = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(
                    event.id,
                    nonPrioritized.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                // Simulate that they completed payment.
                const paidPayment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(
                            eq(p.eventId, event.id),
                            eq(p.userId, nonPrioritized.id),
                        ),
                });
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        status: "paid",
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-123",
                        receivedPaymentAt: new Date(),
                    })
                    .where(eq(schema.eventPayment.id, paidPayment?.id ?? ""));

                await new Promise((resolve) => setTimeout(resolve, 10));

                // Prioritized user registers → should swap out the paid user.
                const prioritizedData = await ctx.auth.api.createUser({
                    body: {
                        email: "prioritized@test.com",
                        name: "Prioritized User",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: prioritizedData.user.id,
                    groupSlug: "index",
                    role: "member",
                });
                await ctx.utils.createPendingRegistration(
                    event.id,
                    prioritizedData.user.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                // Prioritized user has the spot, non-prioritized on waitlist.
                const priorityReg =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (r, { and, eq }) =>
                            and(
                                eq(r.eventId, event.id),
                                eq(r.userId, prioritizedData.user.id),
                            ),
                    });
                expect(priorityReg?.status).toBe("registered");

                const swappedReg =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (r, { and, eq }) =>
                            and(
                                eq(r.eventId, event.id),
                                eq(r.userId, nonPrioritized.id),
                            ),
                    });
                expect(swappedReg?.status).toBe("waitlisted");

                // Refund was issued for the paid, swapped-out user.
                expect(refundMock).toHaveBeenCalledTimes(1);
                expect(refundMock).toHaveBeenCalledWith({
                    reference: "vipps-ref-123",
                    amount: 7500,
                    currency: "NOK",
                });

                const refundedPayment =
                    await ctx.db.query.eventPayment.findFirst({
                        where: (p, { eq }) => eq(p.id, paidPayment?.id ?? ""),
                    });
                expect(refundedPayment?.status).toBe("refunded");
            },
            500_000,
        );
    });
});
