import { randomUUID } from "node:crypto";
import { type DbSchema, schema } from "@photon/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    buildPaymentDescription,
    cancelPayment,
    createPayment,
    getPaymentDetails,
} from "~/lib/vipps";
import { requireAuth } from "~/middleware/auth";
import {
    createPaymentBodySchema,
    createPaymentResponseSchema,
} from "../schema";

export const createPaymentRoute = route().post(
    "/:eventId/payment",
    describeRoute({
        tags: ["events", "payments"],
        summary: "Create payment for event",
        operationId: "createEventPayment",
        description:
            "Initiates a Vipps payment for an event registration. User must have a registered status for the event.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createPaymentResponseSchema,
            description: "Payment created successfully",
        })
        .badRequest({ description: "event not found or not a paid event" })
        .notFound({ description: "Event or registration not found" })
        .response({
            statusCode: 409,
            description: "Payment already exists for this user and event",
        })
        .build(),
    requireAuth,
    validator("json", createPaymentBodySchema),
    async (c) => {
        const eventId = c.req.param("eventId");
        const user = c.get("user");
        const userId = user.id;
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

        // Check for existing payments
        const existingPayments = await db.query.eventPayment.findMany({
            where: (payment, { eq, and }) =>
                and(eq(payment.eventId, eventId), eq(payment.userId, userId)),
        });

        // An unstarted obligation (created automatically on registration) is a
        // pending payment without a provider reference. Reuse it instead of
        // creating a duplicate — the countdown timer already tracks its id.
        let obligation = existingPayments.find(
            (p) => p.status === "pending" && !p.providerPaymentId,
        );

        // Check if already paid
        if (existingPayments.some((p) => p.status === "paid")) {
            throw new HTTPException(409, {
                message: "The user has already paid for the event",
            });
        }

        // A pending payment that has already been handed to Vipps is usually a
        // checkout the member walked away from — they pressed back in the
        // browser instead of paying — and it must not become a dead end. Ask
        // Vipps what actually happened to it: an unfinished checkout is
        // cancelled so this press gets a fresh one, and only a checkout that is
        // genuinely underway blocks a new attempt.
        const startedPayment = existingPayments.find(
            (p) => p.status === "pending" && p.providerPaymentId,
        );

        if (startedPayment?.providerPaymentId) {
            const reference = startedPayment.providerPaymentId;
            let details: Awaited<ReturnType<typeof getPaymentDetails>>;

            try {
                details = await getPaymentDetails(reference);
            } catch {
                // Without an answer from Vipps we cannot tell a paid checkout
                // from an abandoned one, so we keep the safe old behaviour.
                throw new HTTPException(409, {
                    message: "A pending payment already exists for this event",
                });
            }

            // Money has been reserved or drawn: the webhook settles this one,
            // and a second checkout would charge the member twice.
            if (
                details.state === "AUTHORIZED" ||
                details.aggregate.capturedAmount.value > 0 ||
                details.aggregate.authorizedAmount.value > 0
            ) {
                throw new HTTPException(409, {
                    message: "A pending payment already exists for this event",
                });
            }

            if (details.state === "CREATED") {
                try {
                    await cancelPayment(reference);
                } catch {
                    throw new HTTPException(409, {
                        message:
                            "A pending payment already exists for this event",
                    });
                }
            }

            // Nothing was paid, so the row is free to carry the new checkout —
            // and reusing it keeps the payment deadline the member already
            // sees counting down.
            obligation = startedPayment;
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
                description: buildPaymentDescription(event.title, user.name),
            });

            let payment: InferSelectModel<DbSchema["eventPayment"]> | undefined;

            if (obligation) {
                // Attach the Vipps checkout to the existing obligation.
                [payment] = await db
                    .update(schema.eventPayment)
                    .set({
                        provider: "vipps",
                        providerPaymentId: vippsReference,
                        amountMinor: event.priceMinor,
                        currency: "NOK",
                    })
                    .where(eq(schema.eventPayment.id, obligation.id))
                    .returning();
            } else {
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
                [payment] = await db
                    .insert(schema.eventPayment)
                    .values(newPayment)
                    .returning();
            }

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
