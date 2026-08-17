import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { promoteFromWaitlist } from "~/lib/event/payment";
import { issueStrike } from "~/lib/event/strikes";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../../lib/route";
import { requireAuth } from "../../../middleware/auth";

export const deleteEventRegistrationRoute = route().delete(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Unregister from event",
        operationId: "deleteEventRegistration",
        description:
            "Remove the authenticated user's registration from an event. If the event can cause strikes and the user unregisters from a confirmed spot after the cancellation deadline, they are given 1 strike.",
    })
        .response({ statusCode: 200, description: "OK" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const userId = c.get("user").id;
        const eventId = c.req.param("eventId");

        // The columns beyond the strike rule are what promoting someone off
        // the waitlist needs: capacity to see whether a spot actually opened,
        // and the payment fields to give the promoted member their own
        // obligation on a paid event.
        const event = await db.query.event.findFirst({
            columns: {
                id: true,
                title: true,
                slug: true,
                capacity: true,
                canCauseStrikes: true,
                cancellationDeadline: true,
                isPaidEvent: true,
                priceMinor: true,
                paymentGracePeriodMinutes: true,
                enforcesPreviousStrikes: true,
            },
            with: {
                pools: {
                    with: {
                        groups: true,
                    },
                },
            },
            where: eq(schema.event.id, eventId),
        });

        const [deleted] = await db
            .delete(schema.eventRegistration)
            .where(
                and(
                    eq(schema.eventRegistration.userId, userId),
                    eq(schema.eventRegistration.eventId, eventId),
                ),
            )
            .returning();

        if (!deleted) {
            throw new HTTPException(404, { message: "Registration not found" });
        }

        // Late cancellation: only a confirmed ("registered") spot given up after
        // the cancellation deadline earns a strike — waitlisted users are exempt.
        const isLateCancellation =
            event?.canCauseStrikes &&
            event.cancellationDeadline != null &&
            deleted.status === "registered" &&
            new Date() > event.cancellationDeadline;

        if (isLateCancellation) {
            await issueStrike(db, {
                eventId,
                userId,
                count: 1,
                reason: "Avmelding etter avmeldingsfristen",
            });
        }

        /**
         * Giving up a confirmed spot leaves it empty unless someone is moved
         * into it. Nothing did that before: the resolver only ever looks at
         * `pending` rows, and a waitlisted member is `waitlisted` — so the
         * freed spot sat there until some new member happened to register.
         *
         * Only a confirmed spot frees capacity; leaving the waitlist does not.
         */
        if (event && deleted.status === "registered") {
            await promoteFromWaitlist(ctx, event);
        }

        return c.text("OK");
    },
);
