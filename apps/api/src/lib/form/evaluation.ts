import { schema } from "@photon/db";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { AppContext } from "../ctx";

/**
 * How long after an event ends its evaluation keeps blocking registrations.
 *
 * Lepton's window, kept to the day: an evaluation nobody chased within a month
 * is not going to produce a useful answer, and holding the member hostage over
 * it forever only costs them the next bedpres.
 */
const EVALUATION_BLOCK_DAYS = 30;

export type UnansweredEvaluation = {
    formId: string;
    formTitle: string;
    eventId: string;
    eventTitle: string;
    eventEndTime: string;
};

/**
 * Evaluations the member attended an event for but never answered.
 *
 * Ported from Lepton, where an unanswered evaluation blocked registration for
 * anything new — the reason arrangører get answers at all. Only `attended`
 * counts: someone who signed up and stayed home has nothing to evaluate, and
 * `POST /api/forms/:id/submissions` refuses their answer anyway.
 *
 * Only the last {@link EVALUATION_BLOCK_DAYS} days count. The first port of
 * this dropped Lepton's window, and every evaluation ever migrated from Lepton
 * — back to 2021 — then blocked its member permanently: 299 people locked out
 * of every registration over 407 evaluations, none of them newer than six
 * months, none of which the block could still extract an answer from.
 *
 * Newest first, so the reminder names the event they remember best.
 */
export async function getUnansweredEvaluations(
    ctx: Pick<AppContext, "db">,
    userId: string,
): Promise<UnansweredEvaluation[]> {
    const cutoff = new Date(
        Date.now() - EVALUATION_BLOCK_DAYS * 24 * 60 * 60 * 1000,
    );

    const rows = await ctx.db
        .select({
            formId: schema.form.id,
            formTitle: schema.form.title,
            eventId: schema.event.id,
            eventTitle: schema.event.title,
            eventEndTime: schema.event.end,
        })
        .from(schema.eventRegistration)
        .innerJoin(
            schema.formEventForm,
            eq(schema.formEventForm.eventId, schema.eventRegistration.eventId),
        )
        .innerJoin(schema.form, eq(schema.form.id, schema.formEventForm.formId))
        .innerJoin(
            schema.event,
            eq(schema.event.id, schema.eventRegistration.eventId),
        )
        .leftJoin(
            schema.formSubmission,
            and(
                eq(schema.formSubmission.formId, schema.formEventForm.formId),
                eq(schema.formSubmission.userId, userId),
            ),
        )
        .where(
            and(
                eq(schema.eventRegistration.userId, userId),
                eq(schema.eventRegistration.status, "attended"),
                eq(schema.formEventForm.type, "evaluation"),
                gte(schema.event.end, cutoff),
                isNull(schema.formSubmission.id),
            ),
        )
        .orderBy(desc(schema.event.end));

    return rows.map((row) => ({
        ...row,
        eventEndTime: row.eventEndTime.toISOString(),
    }));
}
