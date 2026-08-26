import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canManageForm } from "~/lib/form/service";
import { computeUserClassYear } from "~/lib/event/priority";
import { deriveStudyFromGroups, loadStudyGroupRows } from "~/lib/user/study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { submissionDetailSchema } from "../schema";

export const getSubmissionRoute = route().get(
    "/:formId/submissions/:id",
    describeRoute({
        tags: ["forms"],
        summary: "Get submission",
        operationId: "getFormSubmission",
        description:
            "Get a specific submission. Can view own submission or requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: submissionDetailSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Submission not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");
        const formId = c.req.param("formId");
        const submissionId = c.req.param("id");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Get submission
        const submission = await db.query.formSubmission.findFirst({
            where: and(
                eq(schema.formSubmission.id, submissionId),
                eq(schema.formSubmission.formId, formId),
            ),
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
        });

        if (!submission) {
            throw new HTTPException(404, {
                message: "Submission not found",
            });
        }

        // Check permissions: own submission OR can manage form
        const isOwnSubmission = submission.userId === user.id;
        const canManage = await canManageForm(ctx, formId, user.id);

        if (!isOwnSubmission && !canManage) {
            throw new HTTPException(403, {
                message: "You do not have permission to view this submission",
            });
        }

        const studyRows =
            (await loadStudyGroupRows(ctx, [submission.userId])).get(
                submission.userId,
            ) ?? [];
        const study = deriveStudyFromGroups(studyRows);

        return c.json({
            id: submission.id,
            user: {
                id: submission.user.id,
                name: submission.user.name,
                email: submission.user.email,
                study_program: study.studyProgram,
                // Klassetrinn, ikke kull — se `submissionUserSchema`.
                class_year: computeUserClassYear(studyRows),
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
        });
    },
);
