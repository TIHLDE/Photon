import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { reverseEventPayment } from "~/lib/event/payment";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { refundEventPaymentResponseSchema } from "../schema";

const paramSchema = z.object({
    eventId: z.uuid(),
    paymentId: z.uuid(),
});

export const refundEventPaymentRoute = route().post(
    "/:eventId/payments/:paymentId/refund",
    describeRoute({
        tags: ["events", "payments"],
        summary: "Refund an event payment",
        operationId: "refundEventPayment",
        description:
            "Reverse a completed payment with the payment provider and mark it as refunded. The full remaining refundable amount is returned to the payer. This does not cancel the registration — free the spot separately if that is wanted. Requires 'events:payments:refund'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: refundEventPaymentResponseSchema,
            description: "Payment refunded",
        })
        .badRequest({ description: "Invalid event or payment id" })
        .forbidden({ description: "Requires events:payments:refund" })
        .notFound({ description: "Payment not found on this event" })
        .response({
            statusCode: 409,
            description: "Payment is not in a refundable state",
        })
        .response({
            statusCode: 502,
            description: "The payment provider rejected the refund",
        })
        .build(),
    requireAuth,
    // Deliberately no ownership bypass: moving money requires an explicit
    // grant (the finance role), not merely having created the event.
    requireAccess({ permission: ["events:payments:refund"] }),
    validator("param", paramSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const { eventId, paymentId } = c.req.valid("param");
        const actor = c.get("user");

        const payment = await db.query.eventPayment.findFirst({
            where: (p, { eq }) => eq(p.id, paymentId),
        });

        // Treat a payment belonging to another event as absent, so the nested
        // path is meaningful and ids cannot be probed across events.
        if (!payment || payment.eventId !== eventId) {
            throw new HTTPException(404, { message: "Payment not found" });
        }

        if (payment.status === "refunded") {
            throw new HTTPException(409, {
                message: "Payment has already been refunded",
            });
        }

        if (payment.status !== "paid") {
            throw new HTTPException(409, {
                message: `Only completed payments can be refunded. This payment is ${payment.status}.`,
            });
        }

        if (!payment.providerPaymentId) {
            throw new HTTPException(409, {
                message: "Payment was never started with the provider",
            });
        }

        // Claim the payment before calling the provider: a conditional update
        // means two admins clicking refund at the same time cannot both get
        // past this point and issue two refunds.
        const [claimed] = await db
            .update(schema.eventPayment)
            .set({ status: "refunded" })
            .where(
                and(
                    eq(schema.eventPayment.id, paymentId),
                    eq(schema.eventPayment.status, "paid"),
                ),
            )
            .returning();

        if (!claimed) {
            throw new HTTPException(409, {
                message: "Payment is already being refunded",
            });
        }

        const event = await db.query.event.findFirst({
            where: (e, { eq }) => eq(e.id, eventId),
            columns: { title: true, slug: true },
        });

        let refundedAmountMinor: number;
        try {
            refundedAmountMinor = await reverseEventPayment(ctx, {
                payment: claimed,
                notification: event
                    ? {
                          title: `Betaling refundert for ${event.title}`,
                          description: `Betalingen din for ${event.title} har blitt refundert av en arrangør.`,
                          link: `/arrangementer/${event.slug}`,
                      }
                    : undefined,
            });
        } catch (error) {
            // Release the claim so the refund can be retried once the
            // underlying provider problem is resolved.
            await db
                .update(schema.eventPayment)
                .set({ status: "paid" })
                .where(eq(schema.eventPayment.id, paymentId));

            throw new HTTPException(502, {
                message:
                    error instanceof Error
                        ? error.message
                        : "The payment provider rejected the refund",
            });
        }

        console.warn(
            `[admin] refunded ${refundedAmountMinor} ${claimed.currency} (minor) on payment ${paymentId} for user ${claimed.userId} by ${actor.id}`,
        );

        return c.json({
            id: claimed.id,
            status: "refunded" as const,
            refundedAmountMinor,
            currency: claimed.currency,
        } satisfies z.infer<typeof refundEventPaymentResponseSchema>);
    },
);
