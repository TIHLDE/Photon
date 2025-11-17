import { eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { schema } from "~/db";
import { createFieldsAndOptions } from "~/lib/form/service";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { createFormSchema } from "../../lib/form/schema";

const formResponseSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    template: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["forms"],
        summary: "Create form",
        operationId: "createForm",
        description:
            "Create a new base form template. Requires 'forms:create' permission.",
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": {
                        schema: resolver(formResponseSchema),
                    },
                },
            },
            403: {
                description: "Forbidden - Missing forms:create permission",
            },
        },
    }),
    requireAuth,
    requirePermission("forms:create"),
    validator("json", createFormSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");

        // Create form
        const [form] = await db
            .insert(schema.form)
            .values({
                title: body.title,
                description: body.description,
                isTemplate: body.template,
            })
            .returning();

        if (!form) {
            throw new HTTPException(500, {
                message: "Failed to create form",
            });
        }

        // Create fields and options
        if (body.fields && body.fields.length > 0) {
            await createFieldsAndOptions(db, form.id, body.fields);
        }

        // Fetch complete form with fields
        const createdForm = await db.query.form.findFirst({
            where: eq(schema.form.id, form.id),
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

        return c.json(
            {
                id: createdForm?.id,
                title: createdForm?.title,
                description: createdForm?.description,
                template: createdForm?.isTemplate,
                created_at: createdForm?.createdAt.toISOString(),
                updated_at: createdForm?.updatedAt.toISOString(),
                fields: createdForm?.fields.map((field) => ({
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
            },
            201,
        );
    },
);
