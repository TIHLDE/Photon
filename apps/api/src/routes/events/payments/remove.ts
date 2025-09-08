import { Hono } from "hono";
import z from "zod";
import { describeRoute, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";
import { eventPayment } from "~/db/schema/events";
import { and, eq } from "drizzle-orm";

export const paymentsRemoveRouter = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v7" }),
    paymentId: z.uuid({ version: "v7" }),
});

paymentsRemoveRouter.delete(
    "/:paymentId",
    describeRoute({
        tags: ["events - payments"],
        summary: "Delete payment (placeholder)",
        responses: {
            204: { description: "Deleted" },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:payments:delete"),
    validator("param", paramsSchema),
    async (c) => {
        const { id, paymentId } = c.req.valid("param");
        const res = await db
            .delete(eventPayment)
            .where(
                and(
                    eq(eventPayment.id, paymentId),
                    eq(eventPayment.eventId, id),
                ),
            )
            .returning();
        if (!res[0]) return c.body(null, 404);
        return c.body(null, 204);
    },
);
