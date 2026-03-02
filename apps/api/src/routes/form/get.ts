import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { userHasSubmitted } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { formDetailSchema } from "./schema";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["forms"],
        summary: "Get form",
        operationId: "getForm",
        description: "Get a form by ID with all fields and options",
    })
        .schemaResponse({
            statusCode: 200,
            schema: formDetailSchema,
            description: "Success",
        })
        .notFound({ description: "Form not found" })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const user = c.get("user");
        const formId = c.req.param("id");

        const form = await db.query.form.findFirst({
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

        if (!form) {
            throw new HTTPException(404, {
                message: "Form not found",
            });
        }

        const hasAnswered = user
            ? await userHasSubmitted(db, form.id, user.id)
            : false;

        return c.json({
            id: form.id,
            title: form.title,
            description: form.description,
            template: form.isTemplate,
            resource_type: "Form",
            viewer_has_answered: hasAnswered,
            website_url: `/sporreskjema/${form.id}/`,
            created_at: form.createdAt.toISOString(),
            updated_at: form.updatedAt.toISOString(),
            fields: form.fields.map((field) => ({
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
