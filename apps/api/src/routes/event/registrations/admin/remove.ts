import { Hono } from "hono";
import z from "zod";
import { describeRoute, validator } from "hono-openapi";
import db from "~/db";
import { eventRegistration } from "~/db/schema/events";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const removeRegistrationRoute = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v7" }),
    registrationId: z.uuid({ version: "v7" }),
});

removeRegistrationRoute.delete(
    "/:registrationId",
    describeRoute({
        tags: ["events - registrations"],
        summary: "Admin remove registration",
        responses: { 204: { description: "Deleted" } },
    }),
    requireAuth,
    requirePermissions("events:registrations:delete"),
    validator("param", paramsSchema),
    async (c) => {
        const { id, registrationId } = c.req.valid("param");

        const res = await db
            .delete(eventRegistration)
            .where(
                and(
                    eq(eventRegistration.id, registrationId),
                    eq(eventRegistration.eventId, id),
                ),
            )
            .returning();
        if (!res[0]) return c.body(null, 404);
        return c.body(null, 204);
    },
);
