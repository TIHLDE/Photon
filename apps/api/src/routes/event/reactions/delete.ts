import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { deleteEventReactionResponseSchema } from "../schema";

const paramSchema = z.object({
    eventId: z.uuid(),
});

export const deleteEventReactionRoute = route().delete(
    "/:eventId/reactions",
    describeRoute({
        tags: ["events"],
        summary: "Remove reaction from event",
        operationId: "deleteEventReaction",
        description: "Remove your emoji reaction from an event.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteEventReactionResponseSchema,
            description: "Reaction removed successfully",
        })
        .notFound({ description: "Event or reaction not found" })
        .build(),
    requireAuth,
    validator("param", paramSchema),
    async (c) => {
        const userId = c.get("user").id;
        const { db } = c.get("ctx");
        const { eventId } = c.req.valid("param");

        // Check if event exists
        const event = await db.query.event.findFirst({
            where: eq(schema.event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, {
                message: "Event not found",
            });
        }

        // Check if reaction exists
        const reaction = await db.query.eventReaction.findFirst({
            where: and(
                eq(schema.eventReaction.userId, userId),
                eq(schema.eventReaction.eventId, eventId),
            ),
        });

        if (!reaction) {
            throw new HTTPException(404, {
                message: "Reaction not found",
            });
        }

        // Delete the reaction
        await db
            .delete(schema.eventReaction)
            .where(
                and(
                    eq(schema.eventReaction.userId, userId),
                    eq(schema.eventReaction.eventId, eventId),
                ),
            );

        return c.json({ message: "Reaction removed successfully" });
    },
);
