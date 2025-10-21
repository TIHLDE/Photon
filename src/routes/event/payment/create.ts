import { randomUUID } from "node:crypto";
import type { InferInsertModel } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { type DbSchema, schema } from "~/db";
import { route } from "~/lib/route";
import { createPayment } from "~/lib/vipps";
import { requireAuth } from "~/middleware/auth";

const createPaymentBodySchema = z.object({
    returnUrl: z
        .url()
        .meta({ description: "URL to redirect user after payment" }),
    userFlow: z
        .enum(["WEB_REDIRECT", "NATIVE_REDIRECT"])
        .default("WEB_REDIRECT")
        .meta({ description: "User flow type for payment" }),
});

const createPaymentResponseSchema = z.object({
    eventId: z.uuid(),
    userId: z.string(),
    checkoutUrl: z.url(),
    amount: z.number(),
    currency: z.string(),
});

const createPaymentBodySchemaOpenApi = await resolver(
    createPaymentBodySchema,
).toOpenAPISchema();
const createPaymentResponseSchemaOpenApi = await resolver(
    createPaymentResponseSchema,
).toOpenAPISchema();

export const createPaymentRoute = route().post(
    "/:eventId/payment",
    describeRoute({
        tags: ["events", "payments"],
        summary: "Create payment for event",
        description:
            "Initiates a Vipps payment for an event registration. User must have a registered status for the event.",
        requestBody: {
            content: {
                "application/json": {
                    schema: createPaymentBodySchemaOpenApi.schema,
                },
            },
        },
        responses: {
            201: {
                description: "Payment created successfully",
                content: {
                    "application/json": {
                        schema: createPaymentResponseSchemaOpenApi.schema,
                    },
                },
            },
            400: {
                description:
                    "Bad request - event not found or not a paid event",
            },
            404: {
                description: "Event or registration not found",
            },
            409: {
                description: "Payment already exists for this user and event",
            },
        },
    }),
    requireAuth,
    validator("json", createPaymentBodySchema),
    async (c) => {
        const eventId = c.req.param("eventId");
        const userId = c.get("user").id;
        const body = c.req.valid("json");
        const { db } = c.get("ctx");

        // Get event details
        const event = await db.query.event.findFirst({
            where: (event, { eq }) => eq(event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (!event.isPaidEvent || !event.priceMinor) {
            throw new HTTPException(400, {
                message: "This event does not require payment",
            });
        }

        // Check that user has a registration with "registered" status
        const registration = await db.query.eventRegistration.findFirst({
            where: (reg, { eq, and }) =>
                and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
        });

        if (!registration) {
            throw new HTTPException(404, {
                message: "You must register for the event before paying",
            });
        }

        if (registration.status !== "registered") {
            throw new HTTPException(400, {
                message: `Cannot create payment. Registration status is: ${registration.status}`,
            });
        }

        // Check for existing pending payment
        const existingPayments = await db.query.eventPayment.findMany({
            where: (payment, { eq, and }) =>
                and(eq(payment.eventId, eventId), eq(payment.userId, userId)),
        });

        // Check if there is already a pending payment
        if (existingPayments.some((p) => p.status === "pending")) {
            throw new HTTPException(409, {
                message: "A pending payment already exists for this event",
            });
        }

        // Check if already paid
        if (existingPayments.some((p) => p.status === "paid")) {
            throw new HTTPException(409, {
                message: "The user has already paid for the event",
            });
        }

        // Remaining states are either aborted or refunded. In that case they can create a new payment

        // Generate unique reference for Vipps
        const vippsReference = randomUUID();

        try {
            // Initiate Vipps payment first
            const checkoutUrl = await createPayment({
                amount: event.priceMinor,
                currency: "NOK",
                reference: vippsReference,
                userFlow: body.userFlow,
                returnUrl: body.returnUrl,
                description: `Payment for ${event.title}`,
            });

            const newPayment: InferInsertModel<DbSchema["eventPayment"]> = {
                eventId,
                userId,
                amountMinor: event.priceMinor,
                currency: "NOK",
                provider: "vipps",
                providerPaymentId: vippsReference,
                status: "pending",
            };

            // Create payment record after Vipps payment is created
            const [payment] = await db
                .insert(schema.eventPayment)
                .values(newPayment)
                .returning();

            if (!payment) {
                throw new HTTPException(500, {
                    message: "Failed to create payment record",
                });
            }

            return c.json(
                {
                    eventId: payment.eventId,
                    userId: payment.userId,
                    checkoutUrl,
                    amount: event.priceMinor,
                    currency: "NOK",
                },
                201,
            );
        } catch (error) {
            throw new HTTPException(500, {
                message: `Failed to initiate Vipps payment: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
        }
    },
);
