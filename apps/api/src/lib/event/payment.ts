import { schema } from "@photon/db";
import type { PaymentFlag } from "@photon/db/schema";
import {
    PAYMENT_QUEUE_NAME,
    type QueueJob,
    type WorkerLike,
} from "@photon/core/services/queue";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { sendNotification } from "../notification";
import { capturePayment, getPaymentDetails, refundPayment } from "../vipps";
import { calculateWaitlistPositions } from "./priority";

/**
 * How long a member gets to pay after being promoted from the waiting list.
 *
 * Twelve hours, matching Lepton: a promotion can land at any hour, and a member
 * who is asleep when a spot frees up should not lose it to a two-hour window
 * they never saw. Deliberately not configurable per event, also matching
 * Lepton.
 */
export const WAITLIST_PROMOTION_GRACE_MINUTES = 12 * 60;

/**
 * The extra time granted when the deadline falls due while a Vipps checkout is
 * still alive (or while Vipps cannot be reached).
 *
 * Vipps expires an unfinished payment session on its own after ten minutes, so
 * this is that window plus a little slack for the webhook to land — the
 * extension cannot become an open-ended hold even before the once-only rule
 * below applies.
 */
export const PAYMENT_DEADLINE_EXTENSION_MS = 12 * 60 * 1000;

/**
 * Payload for the delayed job that enforces a paid event's payment deadline.
 */
export type PaymentTimerJobData = {
    eventId: string;
    userId: string;
    paymentId: string;
};

/**
 * Minimal shape of an event needed to reason about its payment obligations.
 * The full event row (and the loaded relations) is structurally compatible.
 */
type PaidEventLike = {
    id: string;
    title: string;
    slug: string;
    /** When the event begins. A payment deadline is never allowed past it. */
    start?: Date | null;
    capacity?: number | null;
    isPaidEvent: boolean;
    priceMinor: number | null;
    paymentGracePeriodMinutes: number | null;
    enforcesPreviousStrikes: boolean;
    pools: Array<{ groupSlug: string | null; classYear: number | null }>;
    priorityUsers: Array<{ userId: string }>;
};

function eventUrl(slug: string): string {
    return `${env.ROOT_URL}/arrangementer/${slug}`;
}

/**
 * Whether `userId` has already paid for `eventId` — a completed payment that
 * has not been reversed.
 *
 * A member who was pushed to the waiting list by a prioritised registration
 * keeps their payment, so that they do not have to pay again (and race a fresh
 * deadline) if a spot frees up. Every place that would otherwise hand out a new
 * obligation has to ask this first.
 */
export async function hasPaidForEvent(
    ctx: AppContext,
    eventId: string,
    userId: string,
): Promise<boolean> {
    const paid = await ctx.db.query.eventPayment.findFirst({
        columns: { id: true },
        where: (p, { and, eq }) =>
            and(
                eq(p.eventId, eventId),
                eq(p.userId, userId),
                eq(p.status, "paid"),
            ),
    });

    return Boolean(paid);
}

/**
 * When a payment obligation created now falls due.
 *
 * The deadline is never allowed to run past the event's start: a member who is
 * promoted three hours before doors open would otherwise hold an unpaid spot
 * through the whole event, which is exactly the spot the deadline exists to
 * pass on. Events that have already started are left uncapped — there is no
 * start left to protect, and capping there would expire the obligation on
 * arrival.
 */
export function paymentDeadline(
    graceMinutes: number,
    eventStart: Date | null | undefined,
    now: Date = new Date(),
): Date {
    const deadline = new Date(now.getTime() + graceMinutes * 60 * 1000);

    if (eventStart && eventStart > now && eventStart < deadline) {
        return eventStart;
    }

    return deadline;
}

/**
 * Create a payment obligation for a user who just secured a spot on a paid
 * event, and schedule a countdown timer that reclaims the spot if the payment
 * is not completed before the deadline.
 *
 * `graceMinutes` overrides the event's own grace period — waiting-list
 * promotions get {@link WAITLIST_PROMOTION_GRACE_MINUTES} rather than the
 * shorter window a direct registration gets.
 *
 * Returns `null` (no-op) when the event is not a payable event, when no grace
 * period applies, or when the user has already paid — a member who kept their
 * payment through a demotion owes nothing on the way back in.
 */
export async function createPaymentObligation(
    ctx: AppContext,
    event: Pick<
        PaidEventLike,
        "id" | "isPaidEvent" | "priceMinor" | "paymentGracePeriodMinutes"
    > & { start?: Date | null },
    userId: string,
    options: { graceMinutes?: number } = {},
): Promise<{ id: string } | null> {
    const graceMinutes =
        options.graceMinutes ?? event.paymentGracePeriodMinutes ?? null;

    if (
        !event.isPaidEvent ||
        event.priceMinor == null ||
        graceMinutes == null ||
        graceMinutes <= 0
    ) {
        return null;
    }

    // Already paid — see {@link hasPaidForEvent}. Handing this member a fresh
    // deadline would cancel a spot they have already paid for, since the
    // checkout route refuses a second payment for the same event.
    if (await hasPaidForEvent(ctx, event.id, userId)) {
        return null;
    }

    const now = new Date();
    const expiresAt = paymentDeadline(graceMinutes, event.start, now);
    const delay = Math.max(0, expiresAt.getTime() - now.getTime());

    const [payment] = await ctx.db
        .insert(schema.eventPayment)
        .values({
            eventId: event.id,
            userId,
            amountMinor: event.priceMinor,
            currency: "NOK",
            // provider/providerPaymentId are filled in once the user starts a
            // Vipps checkout; until then this row is an unstarted obligation.
            status: "pending",
            expiresAt,
        })
        .returning();

    if (!payment) {
        throw new Error(
            `Failed to create payment obligation for user ${userId} on event ${event.id}`,
        );
    }

    await ctx.queue
        .getQueue<PaymentTimerJobData>(PAYMENT_QUEUE_NAME)
        .add(
            "payment-expiration",
            { eventId: event.id, userId, paymentId: payment.id },
            { delay },
        );

    return { id: payment.id };
}

/**
 * Raise (or replace) the flag that puts a payment in front of an organiser.
 *
 * Flagging is best-effort bookkeeping around a decision that has already been
 * made, so a failure here must never take down the caller.
 */
export async function flagPayment(
    ctx: AppContext,
    paymentId: string,
    flag: PaymentFlag,
): Promise<void> {
    try {
        await ctx.db
            .update(schema.eventPayment)
            .set({ flag, flaggedAt: new Date() })
            .where(eq(schema.eventPayment.id, paymentId));
    } catch (error) {
        console.error(`Failed to flag payment ${paymentId} as ${flag}:`, error);
    }
}

/**
 * Minimal shape of a payment row that can be reversed.
 */
export type ReversiblePayment = {
    id: string;
    userId: string;
    amountMinor: number;
    currency: string;
    providerPaymentId: string | null;
};

/**
 * Reverse a completed payment with the provider and mark our row as refunded.
 *
 * The refundable amount is read from the provider rather than assumed: Vipps'
 * refund endpoint only operates on *captured* funds, and a partially refunded
 * payment must only be reversed for the remainder. Returns the amount that was
 * refunded, in minor units.
 *
 * Throws if the payment has no provider reference, if nothing is refundable, or
 * if the provider call fails — callers are expected to translate that into a
 * response and to undo any status they claimed optimistically.
 */
export async function reverseEventPayment(
    ctx: AppContext,
    options: {
        payment: ReversiblePayment;
        notification?: { title: string; description: string; link: string };
    },
): Promise<number> {
    const { payment } = options;

    if (!payment.providerPaymentId) {
        throw new Error("Payment was never started with the provider");
    }

    const details = await getPaymentDetails(payment.providerPaymentId);
    const { capturedAmount, refundedAmount } = details.aggregate;
    const refundable = capturedAmount.value - refundedAmount.value;

    if (capturedAmount.value <= 0) {
        throw new Error(
            "Betalingen er ikke trukket i Vipps, og kan derfor ikke refunderes.",
        );
    }

    if (refundable <= 0) {
        throw new Error("Betalingen er allerede refundert i sin helhet.");
    }

    await refundPayment({
        reference: payment.providerPaymentId,
        amount: refundable,
        currency: payment.currency,
    });

    await ctx.db
        .update(schema.eventPayment)
        .set({ status: "refunded" })
        .where(eq(schema.eventPayment.id, payment.id));

    if (options.notification) {
        await sendNotification(
            { userId: payment.userId, ...options.notification },
            ctx,
        );
    }

    return refundable;
}

/**
 * Promote the highest-ranked waitlisted user into a freed spot, recalculating
 * the remaining waitlist positions. For a paid event the promoted user gets a
 * payment obligation (and countdown timer) of their own, with the longer
 * waiting-list deadline — unless they had already paid before losing the spot,
 * in which case they owe nothing and get no deadline.
 */
export async function promoteFromWaitlist(
    ctx: AppContext,
    event: PaidEventLike,
): Promise<void> {
    // A spot has to actually be free. Callers that just cancelled a
    // registration know one is; the unregister route calls this for every
    // cancellation, including ones that give up a waitlist place rather than a
    // spot, so the count decides rather than the caller.
    const capacity = event.capacity ?? null;

    if (capacity !== null) {
        const [taken] = await ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.eventRegistration)
            .where(
                and(
                    eq(schema.eventRegistration.eventId, event.id),
                    eq(schema.eventRegistration.status, "registered"),
                ),
            );

        if (Number(taken?.count ?? 0) >= capacity) {
            return;
        }
    }

    const waitlisted = await ctx.db.query.eventRegistration.findMany({
        where: (r, { and, eq }) =>
            and(eq(r.eventId, event.id), eq(r.status, "waitlisted")),
        orderBy: (r, { asc }) => asc(r.waitlistPosition),
    });

    const promoted = waitlisted[0];
    if (!promoted) {
        return;
    }

    await ctx.db
        .update(schema.eventRegistration)
        .set({ status: "registered", waitlistPosition: null })
        .where(
            and(
                eq(schema.eventRegistration.eventId, event.id),
                eq(schema.eventRegistration.userId, promoted.userId),
            ),
        );

    const url = eventUrl(event.slug);
    await sendNotification(
        {
            userId: promoted.userId,
            title: `Du har fått plass på ${event.title}!`,
            description: `En plass ble ledig, og du er nå påmeldt ${event.title}.`,
            link: url,
            emailTemplate: {
                name: "RegistrationConfirmedEmail",
                props: {
                    eventName: event.title,
                    eventUrl: url,
                    logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                },
            },
        },
        ctx,
    );

    // The promoted user now owes payment on a paid event — with the longer
    // waiting-list window, and skipped entirely for someone who kept their
    // payment through an earlier demotion.
    await createPaymentObligation(ctx, event, promoted.userId, {
        graceMinutes: WAITLIST_PROMOTION_GRACE_MINUTES,
    });

    // Recalculate positions for everyone still on the waitlist — one pass over
    // the waitlist, not one pass per member of it.
    const positions = await calculateWaitlistPositions(
        event.id,
        event,
        event.enforcesPreviousStrikes,
        ctx.db,
    );

    for (const [userId, newPosition] of positions) {
        await ctx.db
            .update(schema.eventRegistration)
            .set({ waitlistPosition: newPosition })
            .where(
                and(
                    eq(schema.eventRegistration.eventId, event.id),
                    eq(schema.eventRegistration.userId, userId),
                ),
            );
    }
}

/**
 * What the provider says about an obligation whose deadline has just fallen
 * due.
 *
 * - `paid`: the money is in — reconciled and recorded here, so a late or lost
 *   webhook cannot cost a member their spot.
 * - `live`: a checkout is still open. Vipps closes an unfinished session on its
 *   own after ten minutes, so this state cannot last.
 * - `dead`: no checkout, or one that was aborted, expired or terminated
 *   without capturing anything.
 * - `unknown`: Vipps could not be reached, so "unpaid" would be a guess.
 */
type ProviderVerdict = "paid" | "live" | "dead" | "unknown";

/**
 * Ask Vipps what actually happened to a pending obligation, and record a
 * completed payment if that is the answer.
 *
 * Deliberately reads from the provider rather than trusting our own row: the
 * webhook may be late, may have been lost, or may be racing this very check,
 * and the cost of guessing wrong is cancelling a spot somebody has paid for.
 * Lepton does the same thing (`reconcile_orders_from_vipps`) before it touches
 * a registration.
 *
 * **Never call this inside a transaction** — it is up to three round-trips to
 * Vipps, and holding registration locks across them is what took the site down
 * on 2026-08-13.
 */
async function reconcileWithProvider(
    ctx: AppContext,
    payment: {
        id: string;
        amountMinor: number;
        currency: string;
        providerPaymentId: string | null;
        receivedPaymentAt: Date | null;
    },
): Promise<ProviderVerdict> {
    // An obligation the member never even opened a checkout for. Nothing to
    // ask about, and nothing to wait for.
    if (!payment.providerPaymentId) {
        return "dead";
    }

    let details: Awaited<ReturnType<typeof getPaymentDetails>>;
    try {
        details = await getPaymentDetails(payment.providerPaymentId);
    } catch (error) {
        console.error(
            `Could not reach Vipps for payment ${payment.id} at its deadline:`,
            error,
        );
        return "unknown";
    }

    const { capturedAmount } = details.aggregate;

    // AUTHORIZED only reserves the amount; capture it so "paid" means the money
    // was actually collected, exactly as the webhook does.
    if (
        details.state === "AUTHORIZED" &&
        capturedAmount.value < payment.amountMinor
    ) {
        try {
            await capturePayment({
                reference: payment.providerPaymentId,
                amount: payment.amountMinor,
                currency: payment.currency,
            });
        } catch (error) {
            console.error(
                `Failed to capture authorized payment ${payment.id} at its deadline:`,
                error,
            );
            return "unknown";
        }
    }

    if (details.state === "AUTHORIZED" || capturedAmount.value > 0) {
        await ctx.db
            .update(schema.eventPayment)
            .set({
                status: "paid",
                receivedPaymentAt: payment.receivedPaymentAt ?? new Date(),
            })
            .where(eq(schema.eventPayment.id, payment.id));

        return "paid";
    }

    return details.state === "CREATED" ? "live" : "dead";
}

/**
 * Grant this registration its single deadline extension: push the obligation's
 * deadline out and re-arm the countdown.
 *
 * Returns false when the extension has already been spent, which is what stops
 * a member from holding a spot forever by starting a fresh checkout every time
 * the timer comes round. The claim is a conditional update, so two timer runs
 * for the same obligation cannot both extend it.
 */
async function grantDeadlineExtension(
    ctx: AppContext,
    data: PaymentTimerJobData,
    payment: { id: string; deadlineExtendedAt: Date | null },
): Promise<boolean> {
    if (payment.deadlineExtendedAt) {
        return false;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAYMENT_DEADLINE_EXTENSION_MS);

    const [claimed] = await ctx.db
        .update(schema.eventPayment)
        .set({ deadlineExtendedAt: now, expiresAt })
        .where(
            and(
                eq(schema.eventPayment.id, payment.id),
                isNull(schema.eventPayment.deadlineExtendedAt),
            ),
        )
        .returning({ id: schema.eventPayment.id });

    if (!claimed) {
        return false;
    }

    await ctx.queue
        .getQueue<PaymentTimerJobData>(PAYMENT_QUEUE_NAME)
        .add("payment-expiration", data, {
            delay: PAYMENT_DEADLINE_EXTENSION_MS,
        });

    return true;
}

/**
 * Enforce a paid event's payment deadline for a single registration.
 *
 * When the countdown timer fires, the provider is asked what really happened
 * before anything is taken away:
 *
 * - Paid (however late the webhook was) — the member keeps the spot.
 * - A checkout still in progress, or a Vipps we cannot reach — the deadline is
 *   extended once, and only once. An unreachable Vipps is also flagged, so an
 *   organiser knows the eventual outcome rested on a guess.
 * - Anything else — the obligation is marked failed, the registration is
 *   **cancelled** (not moved to the waiting list; the member is off the event
 *   and free to sign up again from scratch), and the top waitlisted member is
 *   promoted into the freed spot.
 *
 * Every provider call happens outside the transaction that changes rows.
 */
export async function handlePaymentExpiration(
    ctx: AppContext,
    data: PaymentTimerJobData,
): Promise<void> {
    const { eventId, userId, paymentId } = data;

    const payment = await ctx.db.query.eventPayment.findFirst({
        where: (p, { eq }) => eq(p.id, paymentId),
    });

    // Obligation gone, already paid, or already refunded — nothing to do.
    if (
        !payment ||
        payment.status === "paid" ||
        payment.status === "refunded"
    ) {
        return;
    }

    const registration = await ctx.db.query.eventRegistration.findFirst({
        where: (r, { and, eq }) =>
            and(eq(r.eventId, eventId), eq(r.userId, userId)),
    });

    // Only reclaim a spot that is still actively held by this user.
    if (!registration || registration.status !== "registered") {
        if (payment.status === "pending") {
            await ctx.db
                .update(schema.eventPayment)
                .set({ status: "failed" })
                .where(eq(schema.eventPayment.id, paymentId));
        }
        return;
    }

    // A member who aborted one checkout and started another holds a second,
    // newer obligation row. Judge them on whichever attempt is still alive,
    // rather than on the one this timer happens to point at — the once-only
    // extension is what keeps that from becoming a loophole.
    const attempts = await ctx.db.query.eventPayment.findMany({
        where: (p, { and, eq }) =>
            and(
                eq(p.eventId, eventId),
                eq(p.userId, userId),
                eq(p.status, "pending"),
            ),
    });

    let verdict: ProviderVerdict = "dead";
    for (const attempt of attempts) {
        const attemptVerdict = await reconcileWithProvider(ctx, attempt);

        if (attemptVerdict === "paid") {
            verdict = "paid";
            break;
        }
        if (attemptVerdict === "live") {
            verdict = "live";
        } else if (attemptVerdict === "unknown" && verdict !== "live") {
            verdict = "unknown";
        }
    }

    // The money is in after all — the spot stands.
    if (verdict === "paid") {
        return;
    }

    if (verdict === "live" || verdict === "unknown") {
        const extended = await grantDeadlineExtension(ctx, data, payment);

        if (verdict === "unknown") {
            // Whatever we end up doing rests on an answer Vipps never gave, so
            // put it in front of an organiser either way.
            await flagPayment(ctx, paymentId, "provider_unreachable");
        }

        if (extended) {
            return;
        }
        // Extension already spent: fall through and reclaim the spot. Chained
        // checkouts buy time once, not indefinitely.
    }

    await ctx.db.transaction(async (tx) => {
        const txCtx = { ...ctx, db: tx };

        // 1. Claim the spot by cancelling it, conditional on it still being
        // held. The reads above happened outside this transaction — they have
        // to, because they talk to Vipps — so a second timer run could
        // otherwise reach this point too and promote twice off the waiting
        // list. The registration is what is being reclaimed, so it is what the
        // claim keys on: keying on the payment row instead would miss the case
        // where that row was already marked failed (an aborted first checkout)
        // while the spot itself was never freed.
        const [claimed] = await tx
            .update(schema.eventRegistration)
            .set({ status: "cancelled", waitlistPosition: null })
            .where(
                and(
                    eq(schema.eventRegistration.eventId, eventId),
                    eq(schema.eventRegistration.userId, userId),
                    eq(schema.eventRegistration.status, "registered"),
                ),
            )
            .returning({ userId: schema.eventRegistration.userId });

        if (!claimed) {
            return;
        }

        // 2. Every unpaid attempt for this member is now moot — the one this
        // timer points at and any later checkout they abandoned.
        await tx
            .update(schema.eventPayment)
            .set({ status: "failed" })
            .where(
                and(
                    eq(schema.eventPayment.eventId, eventId),
                    eq(schema.eventPayment.userId, userId),
                    eq(schema.eventPayment.status, "pending"),
                ),
            );

        // 3. Load the event (with pools) for promotion + notifications.
        const event = await tx.query.event.findFirst({
            where: (e, { eq }) => eq(e.id, eventId),
            with: {
                pools: true,
                priorityUsers: true,
            },
        });

        if (!event) {
            return;
        }

        // Notify the removed user.
        await sendNotification(
            {
                userId,
                title: `Din plass på ${event.title} ble kansellert`,
                description: `Du fullførte ikke betalingen for ${event.title} innen fristen, og plassen din har blitt gitt videre. Du kan melde deg på på nytt.`,
                link: eventUrl(event.slug),
            },
            txCtx,
        );

        // 4. Promote the top waitlisted user into the freed spot.
        await promoteFromWaitlist(txCtx, event);
    });
}

/**
 * Start the worker that processes payment-deadline countdown timers.
 */
export function startPaymentTimerWorker(ctx: AppContext): WorkerLike {
    const worker = ctx.queue.createWorker<PaymentTimerJobData, void>(
        PAYMENT_QUEUE_NAME,
        async (job: QueueJob<PaymentTimerJobData>) => {
            await handlePaymentExpiration(ctx, job.data);
        },
    );

    worker.on("failed", (job, err) => {
        console.error(`❌ Payment timer job ${job?.id} failed:`, err);
    });

    worker.on("error", (err) => {
        console.error("Payment timer worker error:", err);
    });

    return worker;
}
