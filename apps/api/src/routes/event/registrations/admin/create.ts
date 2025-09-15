import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { eventRegistration } from "~/db/schema/events";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

const paramsSchema = z.object({ id: z.uuid({ version: "v4" }) });
const bodySchema = z.object({ userId: z.string().min(1) });
const registrationSchema = z.object({
    id: z.uuid({ version: "v4" }),
    eventId: z.uuid({ version: "v4" }),
    userId: z.string(),
    status: z.enum([
        "registered",
        "waitlisted",
        "cancelled",
        "attended",
        "no_show",
    ]),
    waitlistPosition: z.number().nullable().optional(),
    attendedAt: z.iso.datetime().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const createRegistrationRoute = new Hono().post(
    "/",
    describeRoute({
        tags: ["events - registrations"],
        summary: "Admin create registration for a user",
        responses: {
            201: {
                description: "Created",
                content: {
                    "application/json": {
                        schema: resolver(registrationSchema),
                    },
                },
            },
        },
    }),
    requireAuth,
    requirePermissions("events:registrations:create"),
    validator("param", paramsSchema),
    validator("json", bodySchema),
    async (c) => {
        const { id } = c.req.valid("param");
        const { userId } = c.req.valid("json");

        const existing = await db.query.eventRegistration.findFirst({
            where: (r, { and, eq }) =>
                and(eq(r.eventId, id), eq(r.userId, userId)),
        });
        if (existing) return c.json(existing, 200);

        const [created] = await db
            .insert(eventRegistration)
            .values({ eventId: id, userId, status: "registered" })
            .returning();

        return c.json(created, 201);
    },
);
