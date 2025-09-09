import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const getFeedbackRoute = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v7" }),
    feedbackId: z.uuid({ version: "v7" }),
});
const feedbackSchema = z.object({
    id: z.uuid({ version: "v7" }),
    eventId: z.uuid({ version: "v7" }),
    userId: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
});

getFeedbackRoute.get(
    "/:feedbackId",
    describeRoute({
        tags: ["events - feedback"],
        summary: "Get a single feedback",
        responses: {
            200: {
                description: "Feedback",
                content: {
                    "application/json": { schema: resolver(feedbackSchema) },
                },
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:feedback:get"),
    validator("param", paramsSchema),
    async (c) => {
        const { id, feedbackId } = c.req.valid("param");
        const item = await db.query.eventFeedback.findFirst({
            where: (f, { and, eq }) =>
                and(eq(f.id, feedbackId), eq(f.eventId, id)),
        });
        if (!item) return c.body(null, 404);
        return c.json(item);
    },
);
