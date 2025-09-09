import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { eventPayment } from "~/db/schema/events";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const createPaymentRoute = new Hono();

const idParamSchema = z.object({ id: z.uuid({ version: "v7" }) });
const createPaymentSchema = z.object({
    amountMinor: z.number().int().positive(),
    currency: z.string().length(3).default("NOK"),
    provider: z.string().optional(),
    providerPaymentId: z.string().optional(),
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

const createPaymentSchemaOpenAPI =
    await resolver(createPaymentSchema).toOpenAPISchema();

createPaymentRoute.post(
    "/",
    describeRoute({
        tags: ["events - payments"],
        summary: "Create payment record",
        requestBody: {
            content: {
                "application/json": {
                    schema: createPaymentSchemaOpenAPI.schema,
                },
            },
        },
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": { schema: resolver(paymentSchema) },
                },
            },
        },
    }),
    requireAuth,
    requirePermissions("events:payments:create"),
    validator("param", idParamSchema),
    validator("json", createPaymentSchema),
    async (c) => {
        const id = c.req.param("id");
        const user = c.get("user");
        if (!id || !user) return c.body(null, 400);

        const body = await c.req.json().catch(() => null);
        if (!body) return c.body(null, 400);

        const {
            amountMinor,
            currency = "NOK",
            provider,
            providerPaymentId,
        } = body;

        const [created] = await db
            .insert(eventPayment)
            .values({
                eventId: id,
                userId: user.id,
                amountMinor: Number(amountMinor),
                currency,
                provider,
                providerPaymentId,
                status: "pending",
            })
            .returning();

        return c.json(created, 201);
    },
);
