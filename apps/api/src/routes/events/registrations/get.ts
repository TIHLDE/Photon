import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { requireAuth } from "~/middleware/auth";
import { requirePermissions } from "~/middleware/permission";

export const registrationGetRouter = new Hono();

const paramsSchema = z.object({
    id: z.uuid({ version: "v7" }),
    registrationId: z.uuid({ version: "v7" }),
});

const registrationSchema = z.object({
    id: z.uuid({ version: "v7" }),
    eventId: z.uuid({ version: "v7" }),
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

registrationGetRouter.get(
    "/:registrationId",
    describeRoute({
        tags: ["events - registrations"],
        summary: "Get a single registration",
        responses: {
            200: {
                description: "Registration",
                content: {
                    "application/json": {
                        schema: resolver(registrationSchema),
                    },
                },
            },
            404: { description: "Not found" },
        },
    }),
    requireAuth,
    requirePermissions("events:registrations:get"),
    validator("param", paramsSchema),
    async (c) => {
        const { id, registrationId } = c.req.valid("param");

        const item = await db.query.eventRegistration.findFirst({
            where: (r, { and, eq }) =>
                and(eq(r.id, registrationId), eq(r.eventId, id)),
        });

        if (!item) return c.body(null, 404);
        return c.json(item);
    },
);
