import { Hono } from "hono";
import z from "zod";
import { describeRoute, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";
import { eventFeedback } from "~/db/schema/events";
import { and, eq } from "drizzle-orm";

export const removeFeedbackRoute = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v4" }),
    feedbackId: z.uuid({ version: "v4" }),
});

removeFeedbackRoute.delete(
    "/:feedbackId",
    describeRoute({
        tags: ["events - feedback"],
        summary: "Delete feedback",
        responses: {
            204: { description: "Deleted" },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:feedback:delete"),
    validator("param", paramsSchema),
    async (c) => {
        const { id, feedbackId } = c.req.valid("param");
        const res = await db
            .delete(eventFeedback)
            .where(
                and(
                    eq(eventFeedback.id, feedbackId),
                    eq(eventFeedback.eventId, id),
                ),
            )
            .returning();
        if (!res[0]) return c.body(null, 404);
        return c.body(null, 204);
    },
);
