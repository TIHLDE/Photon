import { and, eq } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "../../../lib/route";
import { requireAuth } from "../../../middleware/auth";

const deleteRegistrationSchema = z.object({});

const deleteRegistrationSchemaOpenApi = await resolver(
    deleteRegistrationSchema,
).toOpenAPISchema();

export const deleteEventRegistrationRoute = route().delete(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Unregister from event",
        operationId: "deleteEventRegistration",
        responses: {
            200: {
                description: "OK",
                content: {
                    "application/json": {
                        schema: deleteRegistrationSchemaOpenApi.schema,
                    },
                },
            },
        },
    }),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");

        const [deleted] = await db
            .delete(schema.eventRegistration)
            .where(
                and(
                    eq(schema.eventRegistration.userId, c.get("user").id),
                    eq(
                        schema.eventRegistration.eventId,
                        c.req.param("eventId"),
                    ),
                ),
            )
            .returning();

        if (!deleted) {
            throw new HTTPException(404, { message: "Registration not found" });
        }

        return c.text("OK");
    },
);
