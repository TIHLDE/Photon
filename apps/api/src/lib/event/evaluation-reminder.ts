import { schema } from "@photon/db";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { EVALUATION_BLOCK_DAYS } from "../form/evaluation";
import { sendNotification } from "../notification";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Only events that ended within this window are reminded about. It matches the
 * window an unanswered evaluation blocks registrations for: past it the
 * evaluation stops costing the member anything, and a reminder about a bedpres
 * a month gone produces no answers either.
 */
export const EVALUATION_REMINDER_LOOKBACK_DAYS = EVALUATION_BLOCK_DAYS;

/**
 * Remind everyone who attended `eventId` to answer its evaluation.
 *
 * Each registration is claimed first — `evaluation_reminder_sent_at` is stamped
 * in a conditional update — so an overlapping cron tick, or a second API
 * instance, cannot remind the same member twice. Members who have already
 * answered are stamped without being sent anything, which is also how a member
 * checked in on an event whose evaluation they filled in on the spot is left
 * alone.
 *
 * Returns the number of members notified.
 */
export async function sendEvaluationReminders(
    eventId: string,
    ctx: AppContext,
): Promise<number> {
    const eventForm = await ctx.db.query.formEventForm.findFirst({
        columns: { formId: true },
        where: and(
            eq(schema.formEventForm.eventId, eventId),
            eq(schema.formEventForm.type, "evaluation"),
        ),
    });

    if (!eventForm) return 0;

    const event = await ctx.db.query.event.findFirst({
        columns: { title: true },
        where: eq(schema.event.id, eventId),
    });

    if (!event) return 0;

    const attendees = await ctx.db.query.eventRegistration.findMany({
        columns: { userId: true },
        where: and(
            eq(schema.eventRegistration.eventId, eventId),
            eq(schema.eventRegistration.status, "attended"),
            isNull(schema.eventRegistration.evaluationReminderSentAt),
        ),
    });

    const link = `/sporreskjema/${eventForm.formId}`;
    const formUrl = `${env.WEBSITE_URL}${link}`;

    let notified = 0;
    for (const { userId } of attendees) {
        const [claimed] = await ctx.db
            .update(schema.eventRegistration)
            .set({ evaluationReminderSentAt: new Date() })
            .where(
                and(
                    eq(schema.eventRegistration.eventId, eventId),
                    eq(schema.eventRegistration.userId, userId),
                    isNull(schema.eventRegistration.evaluationReminderSentAt),
                ),
            )
            .returning({ userId: schema.eventRegistration.userId });

        if (!claimed) continue;

        const answered = await ctx.db.query.formSubmission.findFirst({
            columns: { id: true },
            where: and(
                eq(schema.formSubmission.formId, eventForm.formId),
                eq(schema.formSubmission.userId, userId),
            ),
        });

        if (answered) continue;

        try {
            await sendNotification(
                {
                    userId,
                    title: "Svar på evalueringen",
                    description: `Du var på ${event.title}. Svar på evalueringen — den må være besvart før du kan melde deg på flere arrangementer.`,
                    link,
                    emailTemplate: {
                        name: "EventEvaluationEmail",
                        props: {
                            eventName: event.title,
                            formUrl,
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    },
                },
                ctx,
            );
            notified += 1;
        } catch (error) {
            // One unreachable member must not cost everyone else their
            // reminder. The claim stays: the evaluation is still listed on
            // their profile, and the registration gate still names it.
            console.error(
                `Error sending evaluation reminder to user ${userId} for event ${eventId}:`,
                error,
            );
        }
    }

    return notified;
}

/**
 * Scan for ended events with an evaluation and remind their attendees.
 *
 * Driven off the events rather than the registrations so the sweep stays
 * cheap: the per-event lookup is served by the index on
 * (`event_id`, `status`), while a scan for attended registrations across the
 * whole table is not.
 */
export async function sendEvaluationRemindersForEndedEvents(
    ctx: AppContext,
): Promise<void> {
    const now = new Date();
    const lookbackCutoff = new Date(
        now.getTime() - EVALUATION_REMINDER_LOOKBACK_DAYS * DAY_MS,
    );

    const endedEvents = await ctx.db
        .selectDistinct({ id: schema.event.id })
        .from(schema.event)
        .innerJoin(
            schema.formEventForm,
            eq(schema.formEventForm.eventId, schema.event.id),
        )
        .where(
            and(
                eq(schema.formEventForm.type, "evaluation"),
                lt(schema.event.end, now),
                gt(schema.event.end, lookbackCutoff),
            ),
        );

    for (const event of endedEvents) {
        try {
            await sendEvaluationReminders(event.id, ctx);
        } catch (error) {
            console.error(
                `Error sending evaluation reminders for event ${event.id}:`,
                error,
            );
        }
    }
}
