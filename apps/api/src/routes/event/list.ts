import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "~/db";
import { event } from "~/db/schema/events";
import { desc, asc } from "drizzle-orm";

const listQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    order: z.enum(["asc", "desc"]).optional(),
});

const eventSchema = z.object({
    id: z.uuid({ version: "v4" }),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    capacity: z.number(),
    allowWaitlist: z.boolean(),
    createdByUserId: z.string().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const listRoute = new Hono().get(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "List events",
        responses: {
            200: {
                description: "List of events",
                content: {
                    "application/json": {
                        schema: resolver(
                            z.object({ items: z.array(eventSchema) }),
                        ),
                    },
                },
            },
        },
    }),
    validator("query", listQuerySchema),
    async (c) => {
        const q = c.req.valid("query");
        const limit = q.limit ?? 50;
        const order = q.order === "desc" ? desc : asc;

        const items = await db.query.event.findMany({
            limit,
            orderBy: [order(event.startTime)],
        });

        return c.json({ items });
    },
);
