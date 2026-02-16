import { requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { userHasSubmitted } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const formDetailResponseSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    template: z.boolean(),
    resource_type: z.string(),
    viewer_has_answered: z.boolean(),
    website_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    fields: z.array(
        z.object({
            id: z.uuid(),
            title: z.string(),
            type: z.enum(["text_answer", "multiple_select", "single_select"]),
            required: z.boolean(),
            order: z.number(),
            options: z.array(
                z.object({
                    id: z.uuid(),
                    title: z.string(),
                    order: z.number(),
                }),
            ),
        }),
    ),
});

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
            schema: formDetailResponseSchema,
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
