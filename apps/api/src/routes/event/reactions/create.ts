import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { isMemberAudience } from "~/lib/auth";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { createEventReactionSchema, eventReactionSchema } from "../schema";

const paramSchema = z.object({
    eventId: z.uuid(),
});

export const createEventReactionRoute = route().post(
    "/:eventId/reactions",
    describeRoute({
        tags: ["events"],
        summary: "Add reaction to event",
        operationId: "createEventReaction",
        description:
            "Add or update emoji reaction to an event. Each user has at most one reaction per event, so reacting again replaces it. Requires authentication.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: eventReactionSchema,
            description: "Reaction added successfully",
        })
        .forbidden({
            description: "Reactions not allowed on this event",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    validator("param", paramSchema),
    validator("json", createEventReactionSchema),
    async (c) => {
        const body = c.req.valid("json");
        const user = c.get("user");
        const userId = user.id;
        const { db } = c.get("ctx");
        const { eventId } = c.req.valid("param");

        // Check if event exists and reactions are allowed
        const event = await db.query.event.findFirst({
            where: eq(schema.event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, {
                message: "Event not found",
            });
        }

        // Same answer the detail route gives: a members-only event does not
        // exist for someone who is not a member.
        if (event.visibility === "members" && !isMemberAudience(user)) {
            throw new HTTPException(404, {
                message: "Event not found",
            });
        }

        if (!event.reactionsAllowed) {
            throw new HTTPException(403, {
                message: "Reactions are not allowed on this event",
            });
        }

        // Check if user already has a reaction
        const existingReaction = await db.query.eventReaction.findFirst({
            where: and(
                eq(schema.eventReaction.userId, userId),
                eq(schema.eventReaction.eventId, eventId),
            ),
        });

        if (existingReaction) {
            // Update existing reaction
            const [updatedReaction] = await db
                .update(schema.eventReaction)
                .set({ emoji: body.emoji })
                .where(
                    and(
                        eq(schema.eventReaction.userId, userId),
                        eq(schema.eventReaction.eventId, eventId),
                    ),
                )
                .returning();

            return c.json(updatedReaction);
        }

        // Create new reaction
        const [newReaction] = await db
            .insert(schema.eventReaction)
            .values({
                userId,
                eventId,
                emoji: body.emoji,
            })
            .returning();

        return c.json(newReaction, 201);
    },
);
