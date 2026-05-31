import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { env } from "~/lib/env";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    deleteSubmissionResponseSchema,
    deleteSubmissionWithReasonSchema,
} from "../schema";

export const deleteSubmissionWithReasonRoute = route().delete(
    "/:formId/submissions/:id/destroy_with_reason",
    describeRoute({
        tags: ["forms"],
        summary: "Delete submission with reason",
        operationId: "deleteFormSubmission",
        description:
            "Delete a submission and notify the user with a reason. Admin only.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteSubmissionResponseSchema,
            description: "Success",
        })
        .notFound({ description: "Submission not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "forms:manage" }),
    validator("json", deleteSubmissionWithReasonSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, ...ctx } = c.get("ctx");
        const formId = c.req.param("formId");
        const submissionId = c.req.param("id");

        // Get submission with form and user details
        const submission = await db.query.formSubmission.findFirst({
            where: and(
                eq(schema.formSubmission.id, submissionId),
                eq(schema.formSubmission.formId, formId),
            ),
            with: {
                user: true,
                form: true,
            },
        });

        if (!submission) {
            throw new HTTPException(404, {
                message: "Submission not found",
            });
        }

        // Send email to submitter
        await ctx.email.sendEmailTemplate(
            {
                from: env.MAIL_FROM,
                to: submission.user.email,
                subject: "Ditt svar på spørreskjemaet har blitt slettet",
            },
            "FormSubmissionDeletedEmail",
            {
                formTitle: submission.form.title,
                reason: body.reason,
                logoUrl: `${env.WEBSITE_URL}/logo512.png`,
            },
        );

        // Delete submission (cascades to answers)
        await db
            .delete(schema.formSubmission)
            .where(eq(schema.formSubmission.id, submissionId));

        return c.json({
            detail: "Skjemaet er slettet og brukeren er varslet.",
        });
    },
);
