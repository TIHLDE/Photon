import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { computeClassStanding } from "~/lib/event/priority";
import { describeRoute } from "~/lib/openapi";
import { deriveStudyFromGroups, loadStudyGroupRows } from "~/lib/user/study";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { submissionListSchema } from "../schema";

/**
 * Egne svar på ett skjema.
 *
 * Skjemasiden trenger dem for å kunne si «du har allerede svart» og vise hva
 * som faktisk ble sendt inn — også når skjemaet tar imot flere svar, der
 * brukeren tidligere fikk et blankt skjema uten et hint om at de hadde svart
 * før (issue #672). Ruten er bevisst egen og ikke et filter på
 * `/submissions`: den lista krever tilgang til å administrere skjemaet.
 */
export const listOwnSubmissionsRoute = route().get(
    "/:formId/submissions/me",
    describeRoute({
        tags: ["forms"],
        summary: "List own submissions",
        operationId: "listOwnFormSubmissions",
        description:
            "List the authenticated user's own submissions for a form, newest first. Available to any authenticated user; no form management permission needed.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: submissionListSchema,
            description: "Success",
        })
        .unauthorized({ description: "Authentication required" })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const formId = c.req.param("formId");

        const form = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
            columns: { id: true },
        });

        if (!form) {
            throw new HTTPException(404, { message: "Form not found" });
        }

        const submissions = await db.query.formSubmission.findMany({
            where: and(
                eq(schema.formSubmission.formId, formId),
                eq(schema.formSubmission.userId, user.id),
            ),
            with: {
                user: true,
                answers: {
                    with: {
                        selectedOptions: {
                            with: { option: true },
                        },
                    },
                },
            },
            orderBy: (submissions, { desc }) => [desc(submissions.createdAt)],
        });

        const studyRows =
            (await loadStudyGroupRows(ctx, [user.id])).get(user.id) ?? [];
        const study = deriveStudyFromGroups(studyRows);
        const standing = computeClassStanding(studyRows);

        return c.json(
            submissions.map((submission) => ({
                id: submission.id,
                user: {
                    id: submission.user.id,
                    name: submission.user.name,
                    email: submission.user.email,
                    study_program: study.studyProgram,
                    // Klassetrinn, ikke kull — se `submissionUserSchema`.
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
            })),
        );
    },
);
