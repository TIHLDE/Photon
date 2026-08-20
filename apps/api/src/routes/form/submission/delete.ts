import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { env } from "~/lib/env";
import { canManageForm } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
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
            "Delete a submission and notify the user with a reason. Requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteSubmissionResponseSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Submission not found" })
        .build(),
    requireAuth,
    validator("json", deleteSubmissionWithReasonSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("formId");
        const submissionId = c.req.param("id");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        // Deleting someone's answer is a managing action on the form, so it
        // follows the same rule as reading them: the owning group's grant, or
        // an org-wide one. It used to demand the org-wide one alone, which
        // left the group that owns the form unable to clean up its own.
        if (!(await canManageForm({ db, ...ctx }, formId, user.id))) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to delete submissions for this form",
            });
        }

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
