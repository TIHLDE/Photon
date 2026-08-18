import { schema } from "@photon/db";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { sendNotification } from "../notification";

/**
 * How far back the review sweep looks. An event that started longer ago than
 * this is given up on rather than rescanned forever — the same bound the
 * no-show sweep uses.
 */
export const PAYMENT_REVIEW_LOOKBACK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A member who paid for an event they do not hold a spot on.
 */
type PaymentWithoutSpot = {
    userId: string;
    name: string;
    /** Why they have no spot: on the waiting list, or off the event entirely. */
    registrationStatus: string;
};

/**
 * Tell the organisers, once their event has started, who paid without holding a
 * spot — so they can decide whether to refund.
 *
 * Nothing is refunded automatically. A member displaced by a prioritised
 * registration keeps their payment on purpose: it is what lets them take a spot
 * back without paying again. The moment the event starts that reason expires,
 * but whether the money goes back is a decision for the arranging group, not
 * for a cron job. This turns it into a decision somebody is actually asked to
 * make.
 *
 * Covers both `waitlisted` (displaced, still hoping) and `cancelled` (paid,
 * then left or was removed) — the second group is otherwise invisible.
 *
 * The event is claimed first via a conditional update, so two instances cannot
 * both send it.
 */
export async function notifyOrganizersOfPaymentsWithoutSpot(
    eventId: string,
    ctx: AppContext,
): Promise<number | null> {
    const [claimed] = await ctx.db
        .update(schema.event)
        .set({ paymentReviewNotifiedAt: new Date() })
        .where(
            and(
                eq(schema.event.id, eventId),
                isNull(schema.event.paymentReviewNotifiedAt),
            ),
        )
        .returning({
            id: schema.event.id,
            title: schema.event.title,
            slug: schema.event.slug,
            organizerGroupSlug: schema.event.organizerGroupSlug,
            createdByUserId: schema.event.createdByUserId,
        });

    // Another run got there first.
    if (!claimed) return null;

    const payments = await ctx.db.query.eventPayment.findMany({
        columns: { userId: true },
        where: (p, { and, eq }) =>
            and(eq(p.eventId, eventId), eq(p.status, "paid")),
    });

    if (payments.length === 0) return 0;

    const registrations = await ctx.db.query.eventRegistration.findMany({
        columns: { userId: true, status: true },
        where: eq(schema.eventRegistration.eventId, eventId),
        with: { user: { columns: { name: true } } },
    });

    const registrationByUserId = new Map(
        registrations.map((r) => [r.userId, r]),
    );

    const stranded: PaymentWithoutSpot[] = [];
    for (const { userId } of payments) {
        const registration = registrationByUserId.get(userId);

        if (
            registration?.status === "registered" ||
            registration?.status === "attended"
        ) {
            continue;
        }

        stranded.push({
            userId,
            name: registration?.user?.name ?? "Ukjent bruker",
            registrationStatus: registration?.status ?? "ingen påmelding",
        });
    }

    if (stranded.length === 0) return 0;

    const recipients = await findOrganizerRecipients(ctx, claimed);

    if (recipients.length === 0) {
        console.warn(
            `Event ${eventId} has ${stranded.length} payment(s) without a spot, but no organiser to notify.`,
        );
        return 0;
    }

    const names = stranded.map((s) => s.name).join(", ");
    const description =
        stranded.length === 1
            ? `${names} har betalt for ${claimed.title} uten å ha plass. Vurder om betalingen skal refunderes.`
            : `${stranded.length} personer har betalt for ${claimed.title} uten å ha plass: ${names}. Vurder om betalingene skal refunderes.`;

    let notified = 0;
    for (const userId of recipients) {
        try {
            await sendNotification(
                {
                    userId,
                    title: `Betalinger uten plass på ${claimed.title}`,
                    description,
                    link: `${env.ROOT_URL}/admin/arrangementer/${claimed.id}`,
                },
                ctx,
            );
            notified += 1;
        } catch (error) {
            // One unreachable organiser must not cost the others the notice.
            console.error(
                `Error notifying organiser ${userId} about payments without a spot on event ${eventId}:`,
                error,
            );
        }
    }

    return notified;
}

/**
 * Who to ask: the leaders of the arranging group, or — for an event with no
 * organiser group (older events migrated from Lepton) — whoever created it.
 */
async function findOrganizerRecipients(
    ctx: AppContext,
    event: {
        organizerGroupSlug: string | null;
        createdByUserId: string | null;
    },
): Promise<string[]> {
    if (event.organizerGroupSlug) {
        const leaders = await ctx.db.query.groupMembership.findMany({
            columns: { userId: true },
            where: and(
                eq(schema.groupMembership.groupSlug, event.organizerGroupSlug),
                eq(schema.groupMembership.role, "leader"),
            ),
        });

        if (leaders.length > 0) {
            return leaders.map((l) => l.userId);
        }
    }

    return event.createdByUserId ? [event.createdByUserId] : [];
}

/**
 * Scan for paid events that have started and not yet had their payments
 * reviewed, and notify their organisers.
 */
export async function reviewPaymentsForStartedEvents(
    ctx: AppContext,
): Promise<void> {
    const now = new Date();
    const lookback = new Date(
        now.getTime() - PAYMENT_REVIEW_LOOKBACK_DAYS * DAY_MS,
    );

    const started = await ctx.db.query.event.findMany({
        columns: { id: true },
        where: and(
            eq(schema.event.isPaidEvent, true),
            isNull(schema.event.paymentReviewNotifiedAt),
            lte(schema.event.start, now),
            gt(schema.event.start, lookback),
        ),
    });

    for (const event of started) {
        try {
            await notifyOrganizersOfPaymentsWithoutSpot(event.id, ctx);
        } catch (error) {
            console.error(
                `Error reviewing payments for event ${event.id}:`,
                error,
            );
        }
    }
}
