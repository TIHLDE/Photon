import { schema } from "@photon/db";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../../lib/route";
import { requireAuth } from "../../../middleware/auth";
import { eventRegistrationResponseSchema } from "../schema";

export const registerToEventRoute = route().post(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Register to an event",
        operationId: "createEventRegistration",
        description:
            "Create a new registration for the authenticated user to attend an event, initially with pending status",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventRegistrationResponseSchema,
            description: "OK",
        })
        .notFound({ description: "Event not found" })
        .response({
            statusCode: 409,
            description:
                "Event is not open for registration or user already registered",
        })
        .build(),
    requireAuth,
    async (c) => {
        const now = new Date();
        const eventId = c.req.param("eventId");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        const event = await db.query.event.findFirst({
            where: (event, { eq }) => eq(event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (event.isRegistrationClosed || !event.requiresSigningUp) {
            throw new HTTPException(409, {
                message: "Event is not open for registration",
            });
        }

        // Check if user is already registered
        const existingRegistration = await db.query.eventRegistration.findFirst(
            {
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
            },
        );

        if (existingRegistration) {
            throw new HTTPException(409, {
                message: "User is already registered for this event",
            });
        }

        // Create pending registration in database
        await db.insert(schema.eventRegistration).values({
            eventId,
            userId,
            status: "pending",
        });

        return c.json({
            eventId,
            userId,
            status: "pending" as const,
            createdAt: now.toISOString(),
        });
    },
);
