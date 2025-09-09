import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { eventPayment } from "~/db/schema/events";
import { desc } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const listPaymentRoute = new Hono();

const idParamSchema = z.object({ id: z.uuid({ version: "v7" }) });
const paymentSchema = z.object({
    id: z.uuid({ version: "v7" }),
    eventId: z.uuid({ version: "v7" }),
    userId: z.string(),
    amountMinor: z.number(),
    currency: z.string(),
    provider: z.string().nullable().optional(),
    providerPaymentId: z.string().nullable().optional(),
    status: z.enum(["pending", "paid", "refunded", "failed"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

listPaymentRoute.get(
    "/",
    describeRoute({
        tags: ["events - payments"],
        summary: "List payments for event",
        responses: {
            200: {
                description: "List of payments",
                content: {
                    "application/json": {
                        schema: resolver(
                            z.object({ items: z.array(paymentSchema) }),
                        ),
                    },
                },
            },
        },
    }),
    requireAuth,
    requirePermissions("events:payments:list"),
    validator("param", idParamSchema),
    async (c) => {
        const id = c.req.param("id");
        if (!id) return c.body(null, 400);

        const items = await db.query.eventPayment.findMany({
            where: (p, { eq }) => eq(p.eventId, id),
            orderBy: [desc(eventPayment.createdAt)],
        });

        return c.json({ items });
    },
);
