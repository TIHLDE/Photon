import { Hono } from "hono";
import z from "zod";
import { describeRoute, resolver, validator } from "hono-openapi";
import db from "../../db";

const eventSchema = z.object({
    id: z.uuid({ version: "v4" }),
    slug: z.string(),
    title: z.string(),
    location: z.string().nullable().optional(),
    startTime: z.iso.datetime(),
    endTime: z.iso.datetime(),
    organizer: z
        .object({
            name: z.string(),
            slug: z.string(),
            type: z.string(),
        })
        .nullable(),
    closed: z.boolean(),
    image: z.url().nullable(),
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
                description: "OK",
                content: {
                    "application/json": {
                        schema: resolver(z.array(eventSchema)),
                    },
                },
            },
        },
    }),
    async (c) => {
        const events = await db.query.event.findMany({
            orderBy: (event, { desc }) => [desc(event.start)],
            with: {
                organizer: true,
                category: true,
            },
        });

        const returnEvents = events.map((e) => {
            let organizer: {
                name: string;
                slug: string;
                type: string;
            } | null = null;

            if (e.organizer) {
                organizer = {
                    name: e.organizer.name,
                    slug: e.organizer.slug,
                    type: e.organizer.type as string,
                };
            }

            return {
                id: e.id,
                closed: e.isRegistrationClosed,
                slug: e.slug,
                title: e.title,
                location: e.location,
                startTime: e.start.toISOString(),
                endTime: e.end.toISOString(),
                organizer,
                image: e.imageUrl,
                createdAt: e.createdAt.toISOString(),
                updatedAt: e.updatedAt.toISOString(),
            } as z.infer<typeof eventSchema>;
        });

        return c.json(returnEvents);
    },
);
