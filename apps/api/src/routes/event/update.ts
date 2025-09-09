import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { event } from "~/db/schema/events";
import { eq } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const updateRoute = new Hono();

const updateBodySchema = z
    .object({
        slug: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        startTime: z.iso.datetime().optional(),
        endTime: z.iso.datetime().optional(),
        capacity: z.number().int().positive().optional(),
        allowWaitlist: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
        message: "Provide at least one field",
    });

const eventSchema = z.object({
    id: z.uuid({ version: "v7" }),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    capacity: z.number(),
    allowWaitlist: z.boolean(),
    createdByUserId: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

const idParamSchema = z.object({ id: z.uuid({ version: "v7" }) });

const updateBodySchemaOpenAPI =
    await resolver(updateBodySchema).toOpenAPISchema();

updateRoute.patch(
    "/:id",
    describeRoute({
        tags: ["events"],
        summary: "Update event",
        requestBody: {
            content: {
                "application/json": {
                    schema: updateBodySchemaOpenAPI.schema,
                },
            },
        },
        responses: {
            200: {
                description: "Updated event",
                content: {
                    "application/json": { schema: resolver(eventSchema) },
                },
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:update"),
    validator("param", idParamSchema),
    validator("json", updateBodySchema),
    async (c) => {
        const id = c.req.param("id");
        if (!id) return c.body(null, 400);

        const body = await c.req.json().catch(() => null);
        if (!body) return c.body(null, 400);

        const values: Partial<typeof event.$inferInsert> = {};
        for (const key of [
            "slug",
            "title",
            "description",
            "location",
            "startTime",
            "endTime",
            "capacity",
            "allowWaitlist",
        ]) {
            if (key in body) values[key as keyof typeof values] = body[key];
        }
        if (values.startTime)
            values.startTime = new Date(
                values.startTime as unknown as string,
            ) as Date;
        if (values.endTime)
            values.endTime = new Date(
                values.endTime as unknown as string,
            ) as Date;
        if (values.capacity !== undefined)
            values.capacity = Number(values.capacity) as number;
        if (values.allowWaitlist !== undefined)
            values.allowWaitlist = Boolean(values.allowWaitlist) as boolean;

        const [updated] = await db
            .update(event)
            .set(values)
            .where(eq(event.id, id))
            .returning();

        if (!updated) return c.body(null, 404);

        return c.json(updated);
    },
);
