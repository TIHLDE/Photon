import { schema } from "@photon/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { AppContext } from "../ctx";

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
 * Newest first, so the reminder names the event they remember best.
 */
export async function getUnansweredEvaluations(
    ctx: Pick<AppContext, "db">,
    userId: string,
): Promise<UnansweredEvaluation[]> {
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
                isNull(schema.formSubmission.id),
            ),
        )
        .orderBy(desc(schema.event.end));

    return rows.map((row) => ({
        ...row,
        eventEndTime: row.eventEndTime.toISOString(),
    }));
}
