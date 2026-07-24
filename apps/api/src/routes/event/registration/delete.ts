import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
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
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const eventId = c.req.param("eventId");

        const event = await db.query.event.findFirst({
            columns: {
                id: true,
                canCauseStrikes: true,
                cancellationDeadline: true,
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

        return c.text("OK");
    },
);
