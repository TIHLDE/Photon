import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "../../../db";
import { route } from "../../../lib/route";
import { requireAuth } from "../../../middleware/auth";

const registerSchema = z.object({
    eventId: z.string().uuid(),
    userId: z.string(),
    status: z.literal("pending"),
    createdAt: z.string(),
});

const registerSchemaOpenApi = await resolver(registerSchema).toOpenAPISchema();

export const registerToEventRoute = route().post(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Register to an event",
        responses: {
            200: {
                description: "OK",
                content: {
                    "application/json": {
                        schema: registerSchemaOpenApi.schema,
                    },
                },
            },
            404: {
                description: "Event not found",
            },
            409: {
                description:
                    "Event is not open for registration or user already registered",
            },
        },
    }),
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
