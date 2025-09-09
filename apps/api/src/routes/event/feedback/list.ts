import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { eventFeedback } from "~/db/schema/events";
import { desc } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const listFeedbackRoute = new Hono();

const idParamSchema = z.object({ id: z.uuid({ version: "v4" }) });
const feedbackSchema = z.object({
    id: z.uuid({ version: "v4" }),
    eventId: z.uuid({ version: "v4" }),
    userId: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
});

listFeedbackRoute.get(
    "/",
    describeRoute({
        tags: ["events - feedback"],
        summary: "List feedback for event",
        responses: {
            200: {
                description: "List of feedback",
                content: {
                    "application/json": {
                        schema: resolver(
                            z.object({ items: z.array(feedbackSchema) }),
                        ),
                    },
                },
            },
        },
    }),
    requireAuth,
    requirePermissions("events:feedback:list"),
    validator("param", idParamSchema),
    async (c) => {
        const id = c.req.param("id");
        if (!id) return c.body(null, 400);

        const items = await db.query.eventFeedback.findMany({
            where: (f, { eq }) => eq(f.eventId, id),
            orderBy: [desc(eventFeedback.createdAt)],
        });

        return c.json({ items });
    },
);
