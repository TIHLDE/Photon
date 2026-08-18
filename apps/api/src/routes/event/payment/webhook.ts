import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { flagPayment } from "~/lib/event/payment";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../../lib/route";
import {
    capturePayment,
    getPaymentDetails,
    verifyVippsWebhookRequest,
} from "../../../lib/vipps";

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
        .response({
            statusCode: 200,
            description: "Webhook processed successfully",
        })
        .badRequest({ description: "Invalid webhook payload" })
        .response({
            statusCode: 401,
            description: "Invalid webhook signature",
        })
        .notFound({ description: "Payment not found" })
        .build(),
    async (c) => {
        // Read the raw body BEFORE parsing: the signature is computed over the
        // raw bytes, and the body can only be consumed once.
        const rawBody = await c.req.text();

        // Reject any request that is not authentically signed by Vipps.
        const isAuthentic = await verifyVippsWebhookRequest(c, rawBody);
        if (!isAuthentic) {
            throw new HTTPException(401, {
                message: "Invalid webhook signature",
            });
        }

        const body = JSON.parse(rawBody) as WebhookPayload;
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

            const { capturedAmount, refundedAmount } = vippsPayment.aggregate;

            // Map Vipps payment state to our payment status
            let newStatus: "pending" | "paid" | "refunded" | "failed" =
                "pending";
            let paymentReceived = false;

            // A refunded payment still reports a non-zero capturedAmount, so
            // refunds must be checked *before* captures — otherwise a later
            // webhook delivery flips a refunded payment back to "paid".
            if (
                refundedAmount.value > 0 &&
                refundedAmount.value >= capturedAmount.value
            ) {
                newStatus = "refunded";
            } else {
                // Docs on state https://developer.vippsmobilepay.com/docs/APIs/epayment-api/api-guide/concepts/#payment-states
                switch (vippsPayment.state) {
                    case "AUTHORIZED":
                        // AUTHORIZED only *reserves* the amount; the reservation
                        // expires after a few days and the money is never drawn.
                        // Capture it now so "paid" means actually collected — and
                        // so refunds (which only work on captured amounts) work.
                        if (capturedAmount.value < payment.amountMinor) {
                            await capturePayment({
                                reference,
                                amount: payment.amountMinor,
                                currency: payment.currency,
                            });
                        }
                        newStatus = "paid";
                        paymentReceived = true;
                        break;
                    case "TERMINATED":
                        if (capturedAmount.value > 0) {
                            newStatus = "paid";
                            paymentReceived = true;
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
            }

            // Update payment record using id. `receivedPaymentAt` is only
            // stamped once, so redelivered webhooks never move the recorded
            // payment time.
            await db
                .update(schema.eventPayment)
                .set({
                    status: newStatus,
                    receivedPaymentAt:
                        payment.receivedPaymentAt ??
                        (paymentReceived ? new Date() : null),
                })
                .where(eq(schema.eventPayment.id, payment.id));

            // Safety net: money can land on a registration that is gone — a
            // checkout completed just after the deadline reclaimed the spot, or
            // one finished in another tab after the member unregistered.
            // Nothing here refunds automatically (that is an organiser's call),
            // but it must never pass in silence.
            //
            // A `waitlisted` payer is deliberately *not* flagged: keeping the
            // payment of someone displaced by a prioritised registration is the
            // intended behaviour, not an anomaly, and organisers are reminded
            // about them when the event starts.
            if (newStatus === "paid") {
                const registration = await db.query.eventRegistration.findFirst(
                    {
                        columns: { status: true },
                        where: (r, { and, eq }) =>
                            and(
                                eq(r.eventId, payment.eventId),
                                eq(r.userId, payment.userId),
                            ),
                    },
                );

                // No registration at all, or one that was cancelled. A
                // `no_show` held their spot and paid correctly; a `waitlisted`
                // payer is the intended displacement case above.
                const stranded =
                    !registration || registration.status === "cancelled";

                if (stranded) {
                    await flagPayment(
                        c.get("ctx"),
                        payment.id,
                        "paid_without_spot",
                    );
                    console.warn(
                        `Payment ${payment.id} completed for user ${payment.userId} on event ${payment.eventId}, ` +
                            `but their registration is ${registration?.status ?? "missing"} — flagged for an organiser.`,
                    );
                }
            }

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
