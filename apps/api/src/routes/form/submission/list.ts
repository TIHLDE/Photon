import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canManageForm } from "~/lib/form/service";
import { computeClassStanding } from "~/lib/event/priority";
import { deriveStudyFromGroups, loadStudyGroupRows } from "~/lib/user/study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { submissionListSchema } from "../schema";

export const listSubmissionsRoute = route().get(
    "/:formId/submissions",
    describeRoute({
        tags: ["forms"],
        summary: "List submissions",
        operationId: "listFormSubmissions",
        description:
            "List all submissions for a form. Requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: submissionListSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const formId = c.req.param("formId");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Check if form exists
        const form = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
        });

        if (!form) {
            throw new HTTPException(404, {
                message: "Form not found",
            });
        }

        // Check permissions
        const canManage = await canManageForm(ctx, formId, user.id);

        if (!canManage) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to view submissions for this form",
            });
        }

        // Check if it's an event form - filter out waitlist
        const eventForm = await db.query.formEventForm.findFirst({
            where: eq(schema.formEventForm.formId, formId),
        });

        // Get submissions
        let submissions = await db.query.formSubmission.findMany({
            where: eq(schema.formSubmission.formId, formId),
            with: {
                user: true,
                answers: {
                    with: {
                        selectedOptions: {
                            with: {
                                option: true,
                            },
                        },
                    },
                },
            },
            orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
        });

        // Filter out waitlist users for event forms
        if (eventForm) {
            const submissionUserIds = submissions.map((s) => s.userId);
            const registrations = await db
                .select()
                .from(schema.eventRegistration)
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, eventForm.eventId),
                        eq(schema.eventRegistration.status, "registered"),
                    ),
                );

            const registeredUserIds = new Set(
                registrations.map((r) => r.userId),
            );
            submissions = submissions.filter((s) =>
                registeredUserIds.has(s.userId),
            );
        }

        // Studieretning og klassetrinn for hele lista i én spørring, utledet
        // med den samme rangeringen som profilen bruker — ellers kunne skjemaet
        // og profilen vist to ulike studier for samme person.
        const studyByUser = await loadStudyGroupRows(
            ctx,
            submissions.map((s) => s.userId),
        );

        return c.json(
            submissions.map((submission) => {
                const rows = studyByUser.get(submission.userId) ?? [];
                const study = deriveStudyFromGroups(rows);
                const standing = computeClassStanding(rows);
                return {
                    id: submission.id,
                    user: {
                        id: submission.user.id,
                        name: submission.user.name,
                        email: submission.user.email,
                        study_program: study.studyProgram,
                        /**
                         * Klassetrinn, ikke kull: for en masterstudent er
                         * `studyStartYear` masteropptaket, og svarlista skrev
                         * «kull 2026» om den profilen kaller 4. klasse. Samme
                         * funksjon som profilen og prioriteringspoolene bruker.
                         */
                        class_year: standing.classYear,
                        is_alumni: standing.isAlumni,
                    },
                    created_at: submission.createdAt.toISOString(),
                    updated_at: submission.updatedAt.toISOString(),
                    answers: submission.answers.map((answer) => ({
                        id: answer.id,
                        field_id: answer.fieldId,
                        answer_text: answer.answerText,
                        selected_options: answer.selectedOptions.map((so) => ({
                            id: so.option.id,
                            title: so.option.title,
                        })),
                    })),
                };
            }),
        );
    },
);
