import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { eventFeedback } from "~/db/schema/events";
import { requireAuth } from "~/middleware/auth";

const idParamSchema = z.object({ id: z.uuid({ version: "v4" }) });
const createFeedbackSchema = z.object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(2000).optional(),
});
const feedbackSchema = z.object({
    id: z.uuid({ version: "v4" }),
    eventId: z.uuid({ version: "v4" }),
    userId: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
});

const createFeedbackSchemaOpenAPI =
    await resolver(createFeedbackSchema).toOpenAPISchema();

export const createFeedbackRoute = new Hono().post(
    "/",
    describeRoute({
        tags: ["events - feedback"],
        summary: "Create feedback",
        requestBody: {
            content: {
                "application/json": {
                    schema: createFeedbackSchemaOpenAPI.schema,
                },
            },
        },
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": { schema: resolver(feedbackSchema) },
                },
            },
        },
    }),
    requireAuth,
    validator("param", idParamSchema),
    validator("json", createFeedbackSchema),
    async (c) => {
        const { id } = c.req.valid("param");
        const user = c.get("user");

        const body = await c.req.json().catch(() => null);
        if (!body) return c.body(null, 400);

        const { rating, comment } = body;

        const [created] = await db
            .insert(eventFeedback)
            .values({
                eventId: id,
                userId: user.id,
                rating: rating ? Number(rating) : null,
                comment,
            })
            .returning();

        return c.json(created, 201);
    },
);
