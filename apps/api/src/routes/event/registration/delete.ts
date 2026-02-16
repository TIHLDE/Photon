import { requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../../lib/route";

export const deleteEventRegistrationRoute = route().delete(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Unregister from event",
        operationId: "deleteEventRegistration",
        description:
            "Remove the authenticated user's registration from an event",
    })
        .response({ statusCode: 200, description: "OK" })
        .build(),
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
