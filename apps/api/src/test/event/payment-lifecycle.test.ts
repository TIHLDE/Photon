import { PAYMENT_QUEUE_NAME } from "@photon/core/services/queue";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { PaymentTimerJobData } from "~/lib/event/payment";
import {
    DEFAULT_PAYMENT_GRACE_MINUTES,
    handlePaymentExpiration,
    paymentDeadline,
    promoteFromWaitlist,
    WAITLIST_PROMOTION_GRACE_MINUTES,
} from "~/lib/event/payment";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import * as vipps from "~/lib/vipps";
import type { IntegrationTestContext } from "~/test/config/integration";
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

// The deadline is a constant now, not something an event carries.
const GRACE_MINUTES = DEFAULT_PAYMENT_GRACE_MINUTES;

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

    describe("Fortrengning — betalingen står", () => {
        integrationTest(
            "keeps the payment when a prioritized user takes the spot",
            async ({ ctx }) => {
                /**
                 * A member who is pushed off by a prioritised registration
                 * keeps their money. Refunding here would mean paying again —
                 * and racing a fresh deadline — if a spot frees up later.
                 * Whether the money goes back is an organiser's call at the
                 * event's start, not the resolver's.
                 */
                const refundMock = vi.mocked(vipps.refundPayment);
                refundMock.mockClear();

                await ctx.utils.setupEventCategories();
                await ctx.utils.setupGroups();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 7500,
                });

                // Priority pool requiring "index" membership.
                await ctx.db.insert(schema.eventPriorityPool).values({
                    eventId: event.id,
                    groupSlug: "index",
                    classYear: null,
                });

                // Non-prioritized user grabs the single spot first, and pays.
                const nonPrioritized = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(
                    event.id,
                    nonPrioritized.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

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

                // No money moved, and the payment is still theirs.
                expect(refundMock).not.toHaveBeenCalled();

                const untouched = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, paidPayment?.id ?? ""),
                });
                expect(untouched?.status).toBe("paid");
            },
            500_000,
        );

        integrationTest(
            "gives a promoted, already-paid member no new deadline",
            async ({ ctx }) => {
                /**
                 * The trap this pins down: promoting a member who kept their
                 * payment used to hand them a fresh obligation and countdown.
                 * They cannot pay it — the checkout route refuses a second
                 * payment for the same event — so the timer would cancel the
                 * spot they had just got back.
                 */
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 7500,
                });

                const paidUser = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(
                    event.id,
                    paidUser.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, paidUser.id)),
                });
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        status: "paid",
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-promote",
                        receivedPaymentAt: new Date(),
                    })
                    .where(eq(schema.eventPayment.id, payment?.id ?? ""));

                // Put them on the waiting list, as a displacement would.
                await ctx.db
                    .update(schema.eventRegistration)
                    .set({ status: "waitlisted", waitlistPosition: 1 })
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, event.id),
                            eq(schema.eventRegistration.userId, paidUser.id),
                        ),
                    );

                const eventWithRelations = await ctx.db.query.event.findFirst({
                    where: (e, { eq }) => eq(e.id, event.id),
                    with: { pools: true, priorityUsers: true },
                });
                if (!eventWithRelations) throw new Error("event vanished");

                const jobsBefore = (await getPaymentTimerJobs(ctx)).length;

                await promoteFromWaitlist(ctx, eventWithRelations);

                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, paidUser.id)),
                });
                expect(reg?.status).toBe("registered");

                // No second obligation, and no new countdown to lose the spot to.
                const payments = await ctx.db.query.eventPayment.findMany({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, paidUser.id)),
                });
                expect(payments).toHaveLength(1);
                expect(payments[0]?.status).toBe("paid");

                expect(await getPaymentTimerJobs(ctx)).toHaveLength(jobsBefore);
            },
            500_000,
        );

        integrationTest(
            "gives a promoted, unpaid member the 12-hour waiting-list deadline",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 7500,
                    // Far enough out that the deadline is not capped by it.
                    start: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    end: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
                });

                const waiting = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, waiting.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                await ctx.db
                    .update(schema.eventRegistration)
                    .set({ status: "waitlisted", waitlistPosition: 1 })
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, event.id),
                            eq(schema.eventRegistration.userId, waiting.id),
                        ),
                    );
                // Drop the obligation the direct registration created, so only
                // the promotion's own obligation is left to look at.
                await ctx.db
                    .delete(schema.eventPayment)
                    .where(eq(schema.eventPayment.eventId, event.id));

                const eventWithRelations = await ctx.db.query.event.findFirst({
                    where: (e, { eq }) => eq(e.id, event.id),
                    with: { pools: true, priorityUsers: true },
                });
                if (!eventWithRelations) throw new Error("event vanished");

                const before = Date.now();
                await promoteFromWaitlist(ctx, eventWithRelations);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, waiting.id)),
                });
                expect(payment?.status).toBe("pending");

                const expected =
                    before + WAITLIST_PROMOTION_GRACE_MINUTES * 60 * 1000;
                const expiresAt = payment?.expiresAt?.getTime() ?? 0;
                expect(expiresAt).toBeGreaterThanOrEqual(expected - 1000);
                expect(expiresAt).toBeLessThanOrEqual(expected + 5000);
            },
            500_000,
        );
    });

    describe("Fristen kappes ved arrangementsstart", () => {
        integrationTest(
            "never lets a payment deadline run past the event start",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const start = new Date(Date.now() + 20 * 60 * 1000);
                const event = await ctx.utils.createTestEvent({
                    capacity: 10,
                    isPaidEvent: true,
                    priceMinor: 5000,
                    // Two hours, on an event that starts in twenty minutes.
                    start,
                    end: new Date(start.getTime() + 2 * 60 * 60 * 1000),
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });

                expect(payment?.expiresAt?.getTime()).toBe(start.getTime());

                const jobs = await getPaymentTimerJobs(ctx);
                expect(jobs[0]?.delay).toBeLessThanOrEqual(20 * 60 * 1000);
            },
            500_000,
        );

        it("leaves the deadline uncapped once the event has started", () => {
            const now = new Date();
            const started = new Date(now.getTime() - 60 * 60 * 1000);

            // An obligation created after the start would otherwise expire on
            // arrival, cancelling the spot the moment it was given.
            const deadline = paymentDeadline(120, started, now);
            expect(deadline.getTime()).toBe(now.getTime() + 120 * 60 * 1000);
        });
    });

    describe("Betaling underveis når fristen går ut", () => {
        integrationTest(
            "extends the deadline once while a Vipps checkout is still open",
            async ({ ctx }) => {
                vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
                    state: "CREATED",
                    aggregate: {
                        authorizedAmount: { currency: "NOK", value: 0 },
                        capturedAmount: { currency: "NOK", value: 0 },
                        refundedAmount: { currency: "NOK", value: 0 },
                        cancelledAmount: { currency: "NOK", value: 0 },
                    },
                } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);

                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });

                // They are in the middle of a checkout when the timer fires.
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-live",
                    })
                    .where(eq(schema.eventPayment.id, payment?.id ?? ""));

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: payment?.id ?? "",
                });

                // The spot survives, and the extension is recorded.
                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                });
                expect(reg?.status).toBe("registered");

                const extended = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, payment?.id ?? ""),
                });
                expect(extended?.status).toBe("pending");
                expect(extended?.deadlineExtendedAt).not.toBeNull();

                // Fire again, with the checkout still open: the extension is
                // spent, so this time the spot is reclaimed. That is what stops
                // a member holding a spot forever by keeping a session alive.
                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: payment?.id ?? "",
                });

                const afterSecond =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (r, { and, eq }) =>
                            and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                    });
                expect(afterSecond?.status).toBe("cancelled");
            },
            500_000,
        );

        integrationTest(
            "keeps the spot when Vipps says the payment went through",
            async ({ ctx }) => {
                // The webhook is late (or lost). Asking Vipps directly is what
                // stops a paid member from losing their spot to our own clock.
                vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
                    state: "AUTHORIZED",
                    aggregate: {
                        authorizedAmount: { currency: "NOK", value: 5000 },
                        capturedAmount: { currency: "NOK", value: 5000 },
                        refundedAmount: { currency: "NOK", value: 0 },
                        cancelledAmount: { currency: "NOK", value: 0 },
                    },
                } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);

                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-paid-late",
                    })
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

                const reconciled = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, payment?.id ?? ""),
                });
                expect(reconciled?.status).toBe("paid");
                expect(reconciled?.receivedPaymentAt).not.toBeNull();
            },
            500_000,
        );

        integrationTest(
            "extends and flags when Vipps cannot be reached",
            async ({ ctx }) => {
                vi.mocked(vipps.getPaymentDetails).mockRejectedValue(
                    new Error("Vipps er nede"),
                );

                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const payment = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-down",
                    })
                    .where(eq(schema.eventPayment.id, payment?.id ?? ""));

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: payment?.id ?? "",
                });

                // Vipps downtime is not the member's fault: the spot stands,
                // but an organiser is told the outcome rested on a guess.
                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                });
                expect(reg?.status).toBe("registered");

                const flagged = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, payment?.id ?? ""),
                });
                expect(flagged?.flag).toBe("provider_unreachable");
                expect(flagged?.flaggedAt).not.toBeNull();
                expect(flagged?.deadlineExtendedAt).not.toBeNull();
            },
            500_000,
        );

        integrationTest(
            "still reclaims the spot when the timer's own payment row already failed",
            async ({ ctx }) => {
                /**
                 * Regression: a member aborts their first checkout (the webhook
                 * marks that row `failed`) and starts a second one. The timer
                 * still points at the first row. Idempotency therefore cannot
                 * key on that row being `pending` — it never is again — or the
                 * spot is never reclaimed and the member holds it unpaid
                 * forever. The claim keys on the registration instead.
                 */
                vi.mocked(vipps.getPaymentDetails).mockResolvedValue({
                    state: "ABORTED",
                    aggregate: {
                        authorizedAmount: { currency: "NOK", value: 0 },
                        capturedAmount: { currency: "NOK", value: 0 },
                        refundedAmount: { currency: "NOK", value: 0 },
                        cancelledAmount: { currency: "NOK", value: 0 },
                    },
                } as Awaited<ReturnType<typeof vipps.getPaymentDetails>>);

                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const first = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });

                // The abort webhook has already landed on the first attempt.
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-aborted",
                        status: "failed",
                        deadlineExtendedAt: new Date(),
                    })
                    .where(eq(schema.eventPayment.id, first?.id ?? ""));

                // A second attempt they also abandoned.
                await ctx.db.insert(schema.eventPayment).values({
                    eventId: event.id,
                    userId: user.id,
                    amountMinor: 5000,
                    currency: "NOK",
                    provider: "vipps",
                    providerPaymentId: "vipps-ref-abandoned",
                    status: "pending",
                });

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: first?.id ?? "",
                });

                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                });
                expect(reg?.status).toBe("cancelled");

                // Both attempts are closed out, so nothing is left pending.
                const payments = await ctx.db.query.eventPayment.findMany({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });
                expect(payments.every((p) => p.status === "failed")).toBe(true);
            },
            500_000,
        );

        integrationTest(
            "judges a member on their newest checkout, not the first one",
            async ({ ctx }) => {
                // Abort one checkout, start another: the timer points at the
                // dead row, but the live attempt is what counts.
                vi.mocked(vipps.getPaymentDetails).mockImplementation(
                    async (reference: string) =>
                        ({
                            state:
                                reference === "vipps-ref-second"
                                    ? "CREATED"
                                    : "ABORTED",
                            aggregate: {
                                authorizedAmount: {
                                    currency: "NOK",
                                    value: 0,
                                },
                                capturedAmount: { currency: "NOK", value: 0 },
                                refundedAmount: { currency: "NOK", value: 0 },
                                cancelledAmount: { currency: "NOK", value: 0 },
                            },
                        }) as Awaited<
                            ReturnType<typeof vipps.getPaymentDetails>
                        >,
                );

                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    isPaidEvent: true,
                    priceMinor: 5000,
                });

                const user = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                const first = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(eq(p.eventId, event.id), eq(p.userId, user.id)),
                });
                await ctx.db
                    .update(schema.eventPayment)
                    .set({
                        provider: "vipps",
                        providerPaymentId: "vipps-ref-first",
                    })
                    .where(eq(schema.eventPayment.id, first?.id ?? ""));

                // A second attempt, as the checkout route creates after an
                // aborted one.
                await ctx.db.insert(schema.eventPayment).values({
                    eventId: event.id,
                    userId: user.id,
                    amountMinor: 5000,
                    currency: "NOK",
                    provider: "vipps",
                    providerPaymentId: "vipps-ref-second",
                    status: "pending",
                });

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: first?.id ?? "",
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

    describe("Timer left behind by a previous sign-up", () => {
        /**
         * Signing off a paid event deletes the registration but the obligation
         * from that sign-up keeps its countdown. Sign up again and the old
         * timer falls due against the new spot — which on Silent Disco 2026
         * cancelled a spot the member had already paid for.
         */
        async function seedAbandonedSignup(
            ctx: IntegrationTestContext,
            secondAttempt: { status: "pending" | "paid" },
        ) {
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 5000,
            });
            const user = await ctx.utils.createTestUser();

            // First sign-up: registration, obligation, then off again — the
            // route deletes the registration row.
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            const abandoned = await ctx.db.query.eventPayment.findFirst({
                where: (p, { and, eq }) =>
                    and(eq(p.eventId, event.id), eq(p.userId, user.id)),
            });

            await ctx.db
                .delete(schema.eventRegistration)
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, user.id),
                    ),
                );

            // Second sign-up, a moment later: fresh registration, fresh
            // obligation, fresh deadline.
            await new Promise((resolve) => setTimeout(resolve, 10));
            await ctx.utils.createPendingRegistration(event.id, user.id);
            await resolveRegistrationsForEvent(event.id, ctx);

            if (secondAttempt.status === "paid") {
                await ctx.db
                    .update(schema.eventPayment)
                    .set({ status: "paid", receivedPaymentAt: new Date() })
                    .where(
                        and(
                            eq(schema.eventPayment.eventId, event.id),
                            eq(schema.eventPayment.userId, user.id),
                            eq(schema.eventPayment.status, "pending"),
                        ),
                    );
            }

            return { event, user, abandonedPaymentId: abandoned?.id ?? "" };
        }

        integrationTest(
            "keeps a spot the member paid for on their second sign-up",
            async ({ ctx }) => {
                const { event, user, abandonedPaymentId } =
                    await seedAbandonedSignup(ctx, { status: "paid" });

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: abandonedPaymentId,
                });

                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                });
                expect(reg?.status).toBe("registered");
            },
            500_000,
        );

        integrationTest(
            "leaves the new spot its own deadline to run out",
            async ({ ctx }) => {
                const { event, user, abandonedPaymentId } =
                    await seedAbandonedSignup(ctx, { status: "pending" });

                await handlePaymentExpiration(ctx, {
                    eventId: event.id,
                    userId: user.id,
                    paymentId: abandonedPaymentId,
                });

                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, event.id), eq(r.userId, user.id)),
                });
                expect(reg?.status).toBe("registered");

                // The abandoned obligation is closed out, the live one is not.
                const abandoned = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { eq }) => eq(p.id, abandonedPaymentId),
                });
                expect(abandoned?.status).toBe("failed");

                const live = await ctx.db.query.eventPayment.findFirst({
                    where: (p, { and, eq }) =>
                        and(
                            eq(p.eventId, event.id),
                            eq(p.userId, user.id),
                            eq(p.status, "pending"),
                        ),
                });
                expect(live).toBeDefined();
            },
            500_000,
        );
    });
});
