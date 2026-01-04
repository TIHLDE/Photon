import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { hasPermission } from "~/lib/auth/rbac/permissions";
import { canManageForm, updateFieldsAndOptions } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { updateFormSchema } from "../../lib/form/schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["forms"],
        summary: "Update form",
        operationId: "updateForm",
        description: "Update a form. Requires permission to manage the form.",
    })
        .response(200, "Success")
        .forbidden()
        .notFound()
        .build(),
    requireAuth,
    validator("json", updateFormSchema),
    async (c) => {
        const body = c.req.valid("json");
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
                message: "You do not have permission to update this form",
            });
        }

        // Update form
        await db
            .update(schema.form)
            .set({
                title: body.title,
                description: body.description,
                isTemplate: body.template,
            })
            .where(eq(schema.form.id, formId));

        // Update fields if provided
        if (body.fields) {
            await updateFieldsAndOptions(db, formId, body.fields);
        }

        // Fetch updated form
        const updatedForm = await db.query.form.findFirst({
            where: eq(schema.form.id, formId),
            with: {
                fields: {
                    orderBy: (fields, { asc }) => [asc(fields.order)],
                    with: {
                        options: {
                            orderBy: (options, { asc }) => [asc(options.order)],
                        },
                    },
                },
            },
        });

        return c.json({
            id: updatedForm?.id,
            title: updatedForm?.title,
            description: updatedForm?.description,
            template: updatedForm?.isTemplate,
            created_at: updatedForm?.createdAt.toISOString(),
            updated_at: updatedForm?.updatedAt.toISOString(),
            fields: updatedForm?.fields.map((field) => ({
                id: field.id,
                title: field.title,
                type: field.type,
                required: field.required,
                order: field.order,
                options: field.options.map((opt) => ({
                    id: opt.id,
                    title: opt.title,
                    order: opt.order,
                })),
            })),
        });
    },
);
