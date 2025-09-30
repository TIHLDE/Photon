import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "../../../db";
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
        },
    }),
    requireAuth,
    async (c) => {
        const eventId = c.req.param("eventId");
        const { db } = c.get("services");
        const event = await db.query.event.findFirst({
            where: (event, { eq }) => eq(event.id, eventId),
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        const [registration] = await db
            .insert(schema.eventRegistration)
            .values({
                eventId,
                userId: c.get("user").id,
                status: "pending",
            })
            .returning();

        if (!registration) {
            throw new HTTPException(500);
        }

        return c.json({
            createdAt: registration.createdAt.toISOString(),
            status: registration.status,
        });
    },
);
