import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canManageForm } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { deleteSubmissionResponseSchema } from "../schema";

export const deleteAllSubmissionsRoute = route().delete(
    "/:formId/submissions",
    describeRoute({
        tags: ["forms"],
        summary: "Delete all submissions",
        operationId: "deleteAllFormSubmissions",
        description:
            "Delete all submissions for a form. Requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteSubmissionResponseSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("formId");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const form = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
        });
        if (!form) {
            throw new HTTPException(404, { message: "Form not found" });
        }

        if (!(await canManageForm({ db, ...ctx }, formId, user.id))) {
            throw new HTTPException(403, {
                message:
                    "You do not have permission to delete submissions for this form",
            });
        }

        await db
            .delete(schema.formSubmission)
            .where(eq(schema.formSubmission.formId, formId));

        return c.json({ detail: "Alle svarene på skjemaet er slettet." });
    },
);
