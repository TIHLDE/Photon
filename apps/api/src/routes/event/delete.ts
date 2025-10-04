import { Hono } from "hono";
import db, { schema } from "../../db";
import { eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { requireOwnershipOrPermission } from "../../middleware/ownership";
import { requireAuth } from "~/middleware/auth";

/**
 * Check if a user is the creator/owner of an event.
 */
const isEventOwner = async (
    eventId: string,
    userId: string,
): Promise<boolean> => {
    const event = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, eventId))
        .limit(1)
        .then((res) => res[0]);

    return event?.createdByUserId === userId;
};

export const deleteRoute = new Hono().delete(
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
        const isOwner = c.get("isResourceOwner");

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
                message: isOwner
                    ? "Your event has been successfully deleted"
                    : "Event successfully deleted",
            },
            200,
        );
    },
);
