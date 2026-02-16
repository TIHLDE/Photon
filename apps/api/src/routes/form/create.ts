import { requireAccess, requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { createFieldsAndOptions } from "~/lib/form/service";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { createFormSchema } from "../../lib/form/schema";

const formResponseSchema = z.object({
    id: z.uuid(),
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
    })
        .schemaResponse({
            statusCode: 201,
            schema: formResponseSchema,
            description: "Created",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "forms:create" }),
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
