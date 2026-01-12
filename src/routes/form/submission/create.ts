import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { enqueueEmail } from "~/lib/email";
import FormSubmissionEmail from "~/lib/email/template/form-submission";
import { validateAndCreateSubmission } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createSubmissionSchema } from "../../../lib/form/schema";

export const createSubmissionRoute = route().post(
    "/:formId/submissions",
    describeRoute({
        tags: ["forms"],
        summary: "Create submission",
        operationId: "createFormSubmission",
        description: "Submit answers to a form",
    })
        .response({ statusCode: 201, description: "Created" })
        .forbidden({ description: "Cannot submit to this form" })
        .notFound({ description: "Form not found" })
        .response({
            statusCode: 409,
            description: "Conflict - Duplicate submission not allowed",
        })
        .build(),
    requireAuth,
    validator("json", createSubmissionSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db, ...ctx } = c.get("ctx");
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

        // Check if it's linked to event or group
        const eventForm = await db.query.formEventForm.findFirst({
            where: eq(schema.formEventForm.formId, formId),
        });

        const groupForm = await db.query.formGroupForm.findFirst({
            where: eq(schema.formGroupForm.formId, formId),
        });

        // Validate and create submission
        const submissionId = await validateAndCreateSubmission(
            db,
            formId,
            user.id,
            body.answers,
            {
                eventId: eventForm?.eventId,
                groupSlug: groupForm?.groupSlug,
            },
        );

        // Send email notification for group forms
        if (groupForm?.emailReceiverOnSubmit) {
            const submitter = await db.query.user.findFirst({
                where: eq(schema.user.id, user.id),
            });

            if (submitter) {
                await enqueueEmail(
                    {
                        to: groupForm.emailReceiverOnSubmit,
                        subject: "Nytt spørreskjema svar",
                        component: FormSubmissionEmail({
                            formTitle: form.title,
                            submitterName: submitter.name,
                            groupSlug: groupForm.groupSlug,
                        }),
                    },
                    { queue: ctx.queue },
                );
            }
        }

        return c.json(
            {
                id: submissionId,
                message: "Submission created successfully",
            },
            201,
        );
    },
);
