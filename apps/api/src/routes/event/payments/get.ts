import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

const paramsSchema = z.object({
    id: z.uuid({ version: "v4" }),
    paymentId: z.uuid({ version: "v4" }),
});
const paymentSchema = z.object({
    id: z.uuid({ version: "v4" }),
    eventId: z.uuid({ version: "v4" }),
    userId: z.string(),
    amountMinor: z.number(),
    currency: z.string(),
    provider: z.string().nullable().optional(),
    providerPaymentId: z.string().nullable().optional(),
    status: z.enum(["pending", "paid", "refunded", "failed"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const getPaymentRoute = new Hono().get(
    "/:paymentId",
    describeRoute({
        tags: ["events - payments"],
        summary: "Get a single payment",
        responses: {
            200: {
                description: "Payment",
                content: {
                    "application/json": { schema: resolver(paymentSchema) },
                },
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:payments:get"),
    validator("param", paramsSchema),
    async (c) => {
        const { id, paymentId } = c.req.valid("param");
        const item = await db.query.eventPayment.findFirst({
            where: (p, { and, eq }) =>
                and(eq(p.id, paymentId), eq(p.eventId, id)),
        });
        if (!item) return c.body(null, 404);
        return c.json(item);
    },
);
