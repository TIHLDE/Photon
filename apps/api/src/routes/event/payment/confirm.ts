import { HTTPException } from "hono/http-exception";
import { confirmPaymentForUser } from "~/lib/event/payment";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { confirmPaymentResponseSchema } from "../schema";

/**
 * "Did my payment go through?", asked by the member who just came back from
 * Vipps.
 *
 * Vipps returns the member to the event page the moment they confirm, which is
 * regularly before the webhook has reached us. Until this route existed the
 * page they landed on still said "venter på betaling", and the only way out was
 * to reload until the webhook happened to arrive.
 *
 * The route only ever looks at the caller's own payment, so it cannot be used
 * to poke at anybody else's.
 */
export const confirmPaymentRoute = route().post(
    "/:eventId/payment/confirm",
    describeRoute({
        tags: ["events", "payments"],
        summary: "Confirm own payment for event",
        operationId: "confirmEventPayment",
        description:
            "Asks the payment provider what happened to the caller's outstanding checkout for this event, and records a completed payment. Meant for the moment the member returns from Vipps, before the webhook has arrived.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: confirmPaymentResponseSchema,
            description: "The provider's answer for the caller's checkout",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    async (c) => {
        const eventId = c.req.param("eventId");
        const user = c.get("user");
        const ctx = c.get("ctx");

        const event = await ctx.db.query.event.findFirst({
            columns: { id: true },
            where: (event, { eq }) => eq(event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        const status = await confirmPaymentForUser(ctx, {
            eventId,
            userId: user.id,
        });

        return c.json({ status }, 200);
    },
);
