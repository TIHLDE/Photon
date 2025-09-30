import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
import { schema } from "~/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../../../middleware/auth";
import { HTTPException } from "hono/http-exception";
import { route } from "../../../lib/route";

const deleteRegistrationSchema = z.object({});

const deleteRegistrationSchemaOpenApi = await resolver(
    deleteRegistrationSchema,
).toOpenAPISchema();

export const deleteEventRegistrationRoute = route().delete(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Unregister from event",
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
        const { db } = c.get("services");
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
