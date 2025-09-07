import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { event } from "~/db/schema/events";
import { requireAuth } from "~/middleware/auth";
import type { AuthVariables } from "~/middleware/auth";

export const createRouter = new Hono<{ Variables: AuthVariables }>();

const createBodySchema = z.object({
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    location: z.string().optional(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    capacity: z.number().int().positive(),
    allowWaitlist: z.boolean().optional(),
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

const createBodySchemaOpenAPI =
    await resolver(createBodySchema).toOpenAPISchema();

createRouter.post(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "Create event",
        requestBody: {
            content: {
                "application/json": { schema: createBodySchemaOpenAPI.schema },
            },
        },
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": { schema: resolver(eventSchema) },
                },
            },
        },
    }),
    requireAuth,
    validator("json", createBodySchema),
    async (c) => {
        const body = await c.req.json().catch(() => null);
        if (!body) return c.body(null, 400);

        const user = c.get("user");

        const {
            slug,
            title,
            description,
            location,
            startTime,
            endTime,
            capacity,
            allowWaitlist = true,
        } = body;

        if (!slug || !title || !startTime || !endTime || !capacity) {
            return c.json({ message: "Missing required fields" }, 400);
        }

        const [created] = await db
            .insert(event)
            .values({
                slug,
                title,
                description,
                location,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                capacity: Number(capacity),
                allowWaitlist: Boolean(allowWaitlist),
                createdByUserId: user.id,
            })
            .returning();

        return c.json(created, 201);
    },
);
