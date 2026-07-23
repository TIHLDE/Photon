import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    saveAvailabilityResponseSchema,
    saveAvailabilitySchema,
    slugParamSchema,
} from "./schema";

export const saveAvailabilityRoute = route().put(
    "/events/:slug/availability",
    describeRoute({
        tags: ["motetid"],
        summary: "Save your availability",
        operationId: "saveMotetidAvailability",
        description:
            "Replace the authenticated member's full slot selection for a scheduling event. Rejected after the event's deadline.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: saveAvailabilityResponseSchema,
            description: "Availability saved",
        })
        .notFound({ description: "Event not found" })
        .build(),
    requireAuth,
    validator("param", slugParamSchema),
    validator("json", saveAvailabilitySchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { slug } = c.req.valid("param");
        const { name, slots } = c.req.valid("json");

        const event = await db.query.motetidEvent.findFirst({
            where: eq(schema.motetidEvent.slug, slug),
        });
        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (event.deadline && new Date() > event.deadline) {
            throw new HTTPException(403, {
                message: "Arrangementet er skrivebeskyttet etter fristen",
            });
        }

        const participantId = await db.transaction(async (tx) => {
            const [participant] = await tx
                .insert(schema.motetidParticipant)
                .values({ eventId: event.id, userId, name })
                .onConflictDoUpdate({
                    target: [
                        schema.motetidParticipant.eventId,
                        schema.motetidParticipant.userId,
                    ],
                    set: { name },
                })
                .returning({ id: schema.motetidParticipant.id });

            if (!participant) {
                throw new HTTPException(500, {
                    message: "Failed to save participant",
                });
            }

            await tx
                .delete(schema.motetidSlot)
                .where(eq(schema.motetidSlot.participantId, participant.id));

            if (slots.length) {
                await tx.insert(schema.motetidSlot).values(
                    slots.map((slot) => ({
                        participantId: participant.id,
                        eventId: event.id,
                        date: slot.date,
                        time: slot.time,
                        status: slot.status,
                    })),
                );
            }

            return participant.id;
        });

        return c.json({ participantId }, 200);
    },
);
