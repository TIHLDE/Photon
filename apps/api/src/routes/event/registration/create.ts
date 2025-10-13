import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "../../../db";
import { registrationKey } from "../../../lib/event/resolve-registration";
import { route } from "../../../lib/route";
import { requireAuth } from "../../../middleware/auth";

const registerSchema = z.object({
    registrationId: z
        .string()
        .meta({ description: "The ID of the registration" }),
    status: z.literal("pending"),
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
                description: "Event is not open for registration",
            },
        },
    }),
    requireAuth,
    async (c) => {
        const now = new Date();
        const eventId = c.req.param("eventId");
        const { db, redis } = c.get("ctx");
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

        // Add to cache for resolving the registration
        await redis.set(
            registrationKey({
                eventId: event.id,
                userId: c.get("user").id,
            }),
            now.toISOString(),
        );

        return c.json({
            createdAt: now.toISOString(),
            status: "pending",
        });
    },
);
