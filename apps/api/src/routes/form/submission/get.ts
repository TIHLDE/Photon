import { hasPermission, requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { canManageForm } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const submissionDetailResponseSchema = z.object({
    id: z.uuid(),
    user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
    answers: z.array(
        z.object({
            id: z.uuid(),
            field_id: z.uuid().nullable(),
            answer_text: z.string().nullable(),
            selected_options: z.array(
                z.object({
                    id: z.uuid(),
                    title: z.string(),
                }),
            ),
        }),
    ),
});

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
            schema: submissionDetailResponseSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Submission not found" })
        .build(),
    requireAuth,
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
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
        const hasAdminPermission = await hasPermission(
            { db, ...ctx },
            user.id,
            "forms:manage",
        );
        const canManage = await canManageForm(
            db,
            formId,
            user.id,
            hasAdminPermission,
        );

        if (!isOwnSubmission && !canManage) {
            throw new HTTPException(403, {
                message: "You do not have permission to view this submission",
            });
        }

        return c.json({
            id: submission.id,
            user: {
                id: submission.user.id,
                name: submission.user.name,
                email: submission.user.email,
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
