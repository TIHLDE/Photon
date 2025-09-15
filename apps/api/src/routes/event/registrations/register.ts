import { Hono } from "hono";
import z from "zod";
import { describeRoute, validator } from "hono-openapi";
import db from "~/db";
import {
    event,
    eventRegistration,
    registrationStatus,
} from "~/db/schema/events";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "~/middleware/auth";

const idParamSchema = z.object({ id: z.uuid({ version: "v4" }) });

export const registerRoute = new Hono().post(
    "/register",
    describeRoute({
        tags: ["events - registrations"],
        summary: "Register for event",
        responses: {
            201: { description: "Registered" },
            200: { description: "Already registered" },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    validator("param", idParamSchema),
    async (c) => {
        const eventId = c.req.param("id");
        const user = c.get("user");
        if (!eventId || !user) return c.body(null, 400);

        const found = await db.query.event.findFirst({
            where: (e, { eq }) => eq(e.id, eventId),
        });
        if (!found) return c.body(null, 404);

        const existing = await db.query.eventRegistration.findFirst({
            where: (r, { and, eq }) =>
                and(eq(r.eventId, eventId), eq(r.userId, user.id)),
        });
        if (existing) return c.json(existing, 200);

        const registeredCount = await db
            .select({ n: count() })
            .from(eventRegistration)
            .where(
                and(
                    eq(eventRegistration.eventId, eventId),
                    eq(
                        eventRegistration.status,
                        registrationStatus.enumValues[0],
                    ),
                ),
            );

        const isFull = (registeredCount[0]?.n ?? 0) >= found.capacity;

        type RegistrationStatus =
            (typeof registrationStatus)["enumValues"][number];
        let waitlistPosition: number | null = null;
        let status: RegistrationStatus = "registered";
        if (isFull) {
            status = "waitlisted";
            const waitlisted = await db
                .select({ n: count() })
                .from(eventRegistration)
                .where(
                    and(
                        eq(eventRegistration.eventId, eventId),
                        eq(eventRegistration.status, "waitlisted"),
                    ),
                );
            waitlistPosition = (waitlisted[0]?.n ?? 0) + 1;
        }

        const [created] = await db
            .insert(eventRegistration)
            .values({
                eventId,
                userId: user.id,
                status,
                waitlistPosition: waitlistPosition ?? undefined,
            })
            .returning();

        return c.json(created, 201);
    },
);
