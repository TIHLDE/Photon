import { Hono } from "hono";
import z from "zod";
import { describeRoute, validator } from "hono-openapi";
import db from "~/db";
import { eventRegistration } from "~/db/schema/events";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";

export const cancelRouter = new Hono();

const idParamSchema = z.object({ id: z.uuid({ version: "v7" }) });

cancelRouter.post(
    "/:id/cancel",
    describeRoute({
        tags: ["events"],
        summary: "Cancel registration",
        responses: {
            200: { description: "Cancelled" },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    validator("param", idParamSchema),
    async (c) => {
        const eventId = c.req.param("id");
        const user = c.get("user");
        if (!eventId || !user) return c.body(null, 400);

        const [updated] = await db
            .update(eventRegistration)
            .set({ status: "cancelled", waitlistPosition: null })
            .where(
                and(
                    eq(eventRegistration.eventId, eventId),
                    eq(eventRegistration.userId, user.id),
                ),
            )
            .returning();

        if (!updated) return c.body(null, 404);

        return c.json(updated);
    },
);
