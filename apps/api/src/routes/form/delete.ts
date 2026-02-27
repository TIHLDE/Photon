import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { canManageForm } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { deleteFormResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["forms"],
        summary: "Delete form",
        operationId: "deleteForm",
        description:
            "Delete a form and all associated data. Requires permission to manage the form.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteFormResponseSchema,
            description: "Success",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    async (c) => {
        const { db, ...ctx } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("id");

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

        if (!canManage) {
            throw new HTTPException(403, {
                message: "You do not have permission to delete this form",
            });
        }

        // Delete form (cascades to fields, options, submissions, answers)
        await db.delete(schema.form).where(eq(schema.form.id, formId));

        return c.json({
            detail: "Skjemaet ble slettet",
        });
    },
);
