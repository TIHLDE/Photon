import { schema } from "@photon/db";
import {
    PAYMENT_QUEUE_NAME,
    type QueueJob,
    type WorkerLike,
} from "@photon/core/services/queue";
import { and, eq } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { sendNotification } from "../notification";
import { getPaymentDetails, refundPayment } from "../vipps";
import { calculateWaitlistPosition } from "./priority";

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
    isPaidEvent: boolean;
    priceMinor: number | null;
    paymentGracePeriodMinutes: number | null;
    enforcesPreviousStrikes: boolean;
    pools: Array<{ groups: Array<{ groupSlug: string }> }>;
};

function eventUrl(slug: string): string {
    return `${env.ROOT_URL}/arrangementer/${slug}`;
}

/**
 * Create a payment obligation for a user who just secured a spot on a paid
 * event, and schedule a countdown timer that reclaims the spot if the payment
 * is not completed before the grace period elapses.
 *
 * Returns `null` (no-op) when the event is not a payable event or has no grace
 * period configured — an unpaid, deadline-less "paid" event has no obligation
 * to enforce.
 */
export async function createPaymentObligation(
    ctx: AppContext,
    event: Pick<
        PaidEventLike,
        "id" | "isPaidEvent" | "priceMinor" | "paymentGracePeriodMinutes"
    >,
    userId: string,
): Promise<{ id: string } | null> {
    if (
        !event.isPaidEvent ||
        event.priceMinor == null ||
        event.paymentGracePeriodMinutes == null ||
        event.paymentGracePeriodMinutes <= 0
    ) {
        return null;
    }

    const graceMs = event.paymentGracePeriodMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + graceMs);

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
            { delay: graceMs },
        );

    return { id: payment.id };
}

/**
 * Minimal shape of a payment row that can be reversed.
 */
type ReversiblePayment = {
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
 * If a user who is being pushed off a registered spot has already paid, refund
 * them via the payment processor and mark the payment as refunded.
 *
 * No-op unless the event is a paid event and a completed ("paid") payment with
 * a provider reference exists for the user.
 */
export async function refundPaidRegistration(
    ctx: AppContext,
    event: Pick<PaidEventLike, "id" | "title" | "slug" | "isPaidEvent">,
    userId: string,
): Promise<void> {
    if (!event.isPaidEvent) {
        return;
    }

    const paid = await ctx.db.query.eventPayment.findFirst({
        where: (p, { and, eq }) =>
            and(
                eq(p.eventId, event.id),
                eq(p.userId, userId),
                eq(p.status, "paid"),
            ),
    });

    if (!paid || !paid.providerPaymentId) {
        return;
    }

    await reverseEventPayment(ctx, {
        payment: paid,
        notification: {
            title: `Betaling refundert for ${event.title}`,
            description: `Du mistet plassen din på ${event.title} og betalingen din har blitt refundert.`,
            link: eventUrl(event.slug),
        },
    });
}

/**
 * Promote the highest-ranked waitlisted user into a freed spot, recalculating
 * the remaining waitlist positions. For a paid event the promoted user gets a
 * fresh payment obligation (and countdown timer) of their own.
 */
async function promoteFromWaitlist(
    ctx: AppContext,
    event: PaidEventLike,
): Promise<void> {
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

    // The promoted user now owes payment on a paid event.
    await createPaymentObligation(ctx, event, promoted.userId);

    // Recalculate positions for everyone still on the waitlist.
    for (const reg of waitlisted.slice(1)) {
        const newPosition = await calculateWaitlistPosition(
            reg.userId,
            event.id,
            event.pools,
            event.enforcesPreviousStrikes,
            ctx.db,
        );
        await ctx.db
            .update(schema.eventRegistration)
            .set({ waitlistPosition: newPosition })
            .where(
                and(
                    eq(schema.eventRegistration.eventId, event.id),
                    eq(schema.eventRegistration.userId, reg.userId),
                ),
            );
    }
}

/**
 * Enforce a paid event's payment deadline for a single registration.
 *
 * When the countdown timer fires: if the payment was not completed, the unpaid
 * registration is cancelled (freeing the spot), the obligation is marked
 * failed, and the top waitlisted user is promoted into the freed spot.
 */
export async function handlePaymentExpiration(
    ctx: AppContext,
    data: PaymentTimerJobData,
): Promise<void> {
    const { eventId, userId, paymentId } = data;

    await ctx.db.transaction(async (tx) => {
        const txCtx = { ...ctx, db: tx };

        const payment = await tx.query.eventPayment.findFirst({
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

        const registration = await tx.query.eventRegistration.findFirst({
            where: (r, { and, eq }) =>
                and(eq(r.eventId, eventId), eq(r.userId, userId)),
        });

        // Only reclaim a spot that is still actively held by this user.
        if (!registration || registration.status !== "registered") {
            if (payment.status === "pending") {
                await tx
                    .update(schema.eventPayment)
                    .set({ status: "failed" })
                    .where(eq(schema.eventPayment.id, paymentId));
            }
            return;
        }

        // 1. Mark the unpaid obligation as failed.
        await tx
            .update(schema.eventPayment)
            .set({ status: "failed" })
            .where(eq(schema.eventPayment.id, paymentId));

        // 2. Cancel the unpaid registration, freeing the spot.
        await tx
            .update(schema.eventRegistration)
            .set({ status: "cancelled", waitlistPosition: null })
            .where(
                and(
                    eq(schema.eventRegistration.eventId, eventId),
                    eq(schema.eventRegistration.userId, userId),
                ),
            );

        // 3. Load the event (with pools) for promotion + notifications.
        const event = await tx.query.event.findFirst({
            where: (e, { eq }) => eq(e.id, eventId),
            with: {
                pools: {
                    with: {
                        groups: true,
                    },
                },
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
                description: `Du fullførte ikke betalingen for ${event.title} innen fristen, og plassen din har blitt gitt videre.`,
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
