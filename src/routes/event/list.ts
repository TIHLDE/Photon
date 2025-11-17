import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
import { route } from "../../lib/route";
import { withPagination } from "../../middleware/pagination";

const eventSchema = z.object({
    id: z.uuid({ version: "v4" }).meta({ description: "Event ID" }),
    slug: z.string().meta({ description: "Event slug" }),
    title: z.string().meta({ description: "Event title" }),
    location: z
        .string()
        .nullable()
        .optional()
        .meta({ description: "Event location (nullable)" }),
    startTime: z.iso
        .datetime()
        .meta({ description: "Event start time (ISO 8601)" }),
    endTime: z.iso
        .datetime()
        .meta({ description: "Event end time (ISO 8601)" }),
    organizer: z
        .object({
            name: z.string().meta({ description: "Organizer name" }),
            slug: z.string().meta({ description: "Organizer slug" }),
            type: z.string().meta({ description: "Organizer type" }),
        })
        .nullable()
        .meta({ description: "Event organizer (nullable)" }),
    closed: z.boolean().meta({ description: "Is registration closed" }),
    image: z
        .url()
        .nullable()
        .meta({ description: "Event image URL (nullable)" }),
    createdAt: z.iso
        .datetime()
        .meta({ description: "Event creation time (ISO 8601)" }),
    updatedAt: z.iso
        .datetime()
        .meta({ description: "Event update time (ISO 8601)" }),
    category: z
        .object({
            slug: z.string().meta({ description: "Category slug" }),
            label: z.string().meta({ description: "Category label" }),
        })
        .meta({ description: "Event category" }),
});

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "List events",
        operationId: "listEvents",
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
    ...withPagination(),
    async (c) => {
        const { db } = c.get("ctx");
        const events = await db.query.event.findMany({
            orderBy: (event, { desc }) => [desc(event.start)],
            with: {
                organizer: true,
                category: true,
            },
            limit: c.get("limit"),
            offset: c.get("offset"),
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
                category: {
                    slug: e.category.slug,
                    label: e.category.label,
                },
            } as z.infer<typeof eventSchema>;
        });

        return c.json(returnEvents);
    },
);
