import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";
import { eventPayment } from "~/db/schema/events";
import { and, eq } from "drizzle-orm";

export const updatePaymentRoute = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v7" }),
    paymentId: z.uuid({ version: "v7" }),
});
const bodySchema = z.object({
    status: z.enum(["pending", "paid", "refunded", "failed"]).optional(),
    provider: z.string().nullable().optional(),
    providerPaymentId: z.string().nullable().optional(),
});
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

updatePaymentRoute.patch(
    "/:paymentId",
    describeRoute({
        tags: ["events - payments"],
        summary: "Update payment (placeholder)",
        responses: {
            200: {
                description: "Updated",
                content: {
                    "application/json": { schema: resolver(paymentSchema) },
                },
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:payments:update"),
    validator("param", paramsSchema),
    validator("json", bodySchema),
    async (c) => {
        const { id, paymentId } = c.req.valid("param");
        const body = c.req.valid("json");
        const [updated] = await db
            .update(eventPayment)
            .set({
                status: body.status ?? undefined,
                provider: body.provider ?? undefined,
                providerPaymentId: body.providerPaymentId ?? undefined,
            })
            .where(
                and(
                    eq(eventPayment.id, paymentId),
                    eq(eventPayment.eventId, id),
                ),
            )
            .returning();
        if (!updated) return c.body(null, 404);
        return c.json(updated);
    },
);
