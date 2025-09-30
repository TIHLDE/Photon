import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import db, { schema } from "../../../db";
import { HTTPException } from "hono/http-exception";
import { getPaymentDetails } from "../../../lib/vipps";
import { eq, and } from "drizzle-orm";

export const paymentWebhookRoute = new Hono().post(
    "/payment/webhook/:id",
    describeRoute({
        tags: ["payments", "webhooks"],
        summary: "Vipps payment webhook",
        description:
            "Webhook endpoint for Vipps to notify about payment status changes. Updates payment record based on Vipps payment state.",
        responses: {
            200: {
                description: "Webhook processed successfully",
            },
            400: {
                description: "Invalid webhook payload",
            },
            404: {
                description: "Payment not found",
            },
        },
    }),
    async (c) => {
        const body = await c.req.json();

        console.log(JSON.stringify(c.req));

        // Vipps webhook payload structure
        const { reference, state } = body as {
            reference?: string;
            state?: string;
        };

        if (!reference) {
            throw new HTTPException(400, {
                message: "Missing payment reference in webhook payload",
            });
        }

        // Get payment details from our database using providerPaymentId
        const payment = await db.query.eventPayment.findFirst({
            where: (payment, { eq }) =>
                eq(payment.providerPaymentId, reference),
        });

        if (!payment) {
            throw new HTTPException(404, {
                message: `Payment not found for reference: ${reference}`,
            });
        }

        try {
            // Fetch latest payment details from Vipps to verify
            const vippsPayment = await getPaymentDetails(reference);

            // Map Vipps payment state to our payment status
            let newStatus: "pending" | "paid" | "refunded" | "failed" =
                "pending";
            let receivedPaymentAt: Date | null = null;

            switch (vippsPayment.state) {
                case "AUTHORIZED":
                    newStatus = "paid";
                    receivedPaymentAt = new Date();
                    break;
                case "TERMINATED":
                    // Check if this was a refund or capture
                    if (
                        vippsPayment.aggregate.refundedAmount.value > 0 &&
                        vippsPayment.aggregate.refundedAmount.value ===
                            vippsPayment.aggregate.authorizedAmount.value
                    ) {
                        newStatus = "refunded";
                    } else if (
                        vippsPayment.aggregate.capturedAmount.value > 0
                    ) {
                        newStatus = "paid";
                        receivedPaymentAt = new Date();
                    } else {
                        newStatus = "failed";
                    }
                    break;
                case "ABORTED":
                    newStatus = "failed";
                    break;
                case "CREATED":
                    newStatus = "pending";
                    break;
            }

            // Update payment record using composite key
            await db
                .update(schema.eventPayment)
                .set({
                    status: newStatus,
                    receivedPaymentAt:
                        receivedPaymentAt || payment.receivedPaymentAt,
                })
                .where(
                    and(
                        eq(schema.eventPayment.eventId, payment.eventId),
                        eq(schema.eventPayment.userId, payment.userId),
                    ),
                );

            return c.json(
                {
                    message: "Webhook processed successfully",
                    eventId: payment.eventId,
                    userId: payment.userId,
                    status: newStatus,
                },
                200,
            );
        } catch (error) {
            throw new HTTPException(500, {
                message: `Failed to process webhook: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
        }
    },
);
