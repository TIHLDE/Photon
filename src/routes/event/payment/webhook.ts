import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { schema } from "../../../db";
import { route } from "../../../lib/route";
import { getPaymentDetails } from "../../../lib/vipps";

/**
 * For documentation, please visit https://developer.vippsmobilepay.com/docs/APIs/webhooks-api/events/#epayment-api-event-types
 */
export interface WebhookPayload {
    msn: string;
    reference: string;
    pspReference: string;
    name: string;
    amount: Amount;
    timestamp: Date;
    idempotencyKey: string | null;
    success: boolean;
}

export interface Amount {
    currency: string;
    value: number;
}

export const paymentWebhookRoute = route().post(
    "/payment/webhook",
    describeRoute({
        tags: ["payments", "webhooks"],
        summary: "Vipps payment webhook",
        operationId: "handlePaymentWebhook",
        description:
            "Webhook endpoint for Vipps to notify about payment status changes. Updates payment record based on Vipps payment state.",
    })
        .response(200, "Webhook processed successfully")
        .badRequest("Invalid webhook payload")
        .notFound("Payment not found")
        .build(),
    async (c) => {
        const body = (await c.req.json()) as WebhookPayload;
        const { db } = c.get("ctx");

        // Vipps webhook payload structure
        const { reference } = body;

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
            throw new HTTPException(409, {
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

            // Docs on state https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/concepts/#payment-states
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
                case "EXPIRED":
                    newStatus = "failed";
                    break;
            }

            // Update payment record using id
            await db
                .update(schema.eventPayment)
                .set({
                    status: newStatus,
                    receivedPaymentAt:
                        receivedPaymentAt || payment.receivedPaymentAt,
                })
                .where(eq(schema.eventPayment.id, payment.id));

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
