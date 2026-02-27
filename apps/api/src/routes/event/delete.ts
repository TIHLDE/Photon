import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { requireAccess } from "~/middleware/access";
import { isEventOwner } from "../../lib/event/middleware";
import { route } from "../../lib/route";
import { requireAuth } from "../../middleware/auth";
import { deleteEventResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:eventId",
    describeRoute({
        tags: ["events"],
        summary: "Delete an event",
        operationId: "deleteEvent",
        description:
            "Delete an event by its ID. Event creators can delete their own events. Users with 'events:delete' permission can delete any event. This action is irreversible and will remove all associated data, including registrations and feedback.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteEventResponseSchema,
            description: "Event successfully deleted",
        })
        .forbidden({
            description:
                "You must be the event creator or have events:delete permission",
        })
        .notFound({ description: "Event with the specified ID does not exist" })
        .build(),
    requireAuth,
    requireAccess({
        permission: "events:delete",
        ownership: { param: "eventId", check: isEventOwner },
    }),
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
