import { eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { schema } from "../../db";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { requireOwnershipOrPermission } from "../../middleware/ownership";
import { isEventOwner } from "../../lib/event/middleware";

export const deleteRoute = route().delete(
    "/:eventId",
    describeRoute({
        tags: ["events"],
        summary: "Delete an event",
        description:
            "Delete an event by its ID. Event creators can delete their own events. Users with 'events:delete' permission can delete any event. This action is irreversible and will remove all associated data, including registrations and feedback.",
        responses: {
            200: {
                description: "Event successfully deleted",
            },
            403: {
                description:
                    "Forbidden - You must be the event creator or have events:delete permission",
            },
            404: {
                description:
                    "Not Found - Event with the specified ID does not exist",
            },
        },
    }),
    requireAuth,
    requireOwnershipOrPermission("eventId", isEventOwner, "events:delete"),
    async (c) => {
        const { eventId } = c.req.param();
        const { db } = c.get("ctx");

        // Check if the event exists
        const event = await db
            .select()
            .from(schema.event)
            .where(eq(schema.event.id, eventId))
            .limit(1)
            .then((res) => res[0]);

        if (!event) {
            return c.json({ message: "Event not found" }, 404);
        }

        // Delete the event and all associated data in a transaction
        await db.transaction(async (tx) => {
            await tx.delete(schema.event).where(eq(schema.event.id, eventId));
        });

        return c.json(
            {
                message: c.get("isResourceOwner")
                    ? "Your event has been successfully deleted"
                    : "Event successfully deleted",
            },
            200,
        );
    },
);
