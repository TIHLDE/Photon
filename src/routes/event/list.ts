import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";
import {
    getPageOffset,
    getTotalPages,
    PaginationSchema,
    PagniationResponseSchema,
} from "../../middleware/pagination";
import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { schema } from "~/db";
import { validator } from "hono-openapi";

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
        .date()
        .meta({ description: "Event start time (ISO 8601)" }),
    endTime: z.iso.date().meta({ description: "Event end time (ISO 8601)" }),
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
        .date()
        .meta({ description: "Event creation time (ISO 8601)" }),
    updatedAt: z.iso
        .date()
        .meta({ description: "Event update time (ISO 8601)" }),
    category: z
        .object({
            slug: z.string().meta({ description: "Category slug" }),
            label: z.string().meta({ description: "Category label" }),
        })
        .meta({ description: "Event category" }),
});

const filterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Search term to filter events by title",
    }),
    expired: z.coerce.boolean().optional().meta({
        description: "Whether to include expired events or not",
    }),
    openSignUp: z.coerce.boolean().optional().meta({
        description: "Whether to include only events with open sign-ups",
    }),
});

const ResponseSchema = PagniationResponseSchema.extend({
    items: z.array(eventSchema).describe("List of events"),
});

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["events"],
        summary: "List events",
        operationId: "listEvents",
        description:
            "Retrieve a paginated list of all events with basic information including organizer and category details",
    })
        .schemaResponse({
            statusCode: 200,
            schema: ResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", filterSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize, search, expired, openSignUp } =
            c.req.valid("query");

        const filters = and(
            ...[
                search ? ilike(schema.event.title, `%${search}%`) : undefined,
                // TODO: Test if works :)
                expired != null
                    ? eq(sql`NOW() > ${schema.event.end}`, expired)
                    : undefined,
                // TODO: Test if works :)
                openSignUp === true
                    ? and(
                          eq(schema.event.requiresSigningUp, true),
                          lte(schema.event.registrationEnd, new Date()),
                          gte(schema.event.registrationStart, new Date()),
                      )
                    : undefined,
            ].filter(Boolean),
        );

        const eventCount = await db.$count(schema.event, filters);

        const pageOffset = getPageOffset(page, pageSize);
        const totalPages = getTotalPages(eventCount, pageSize);

        const events = await db.query.event.findMany({
            orderBy: (event, { desc }) => [desc(event.start)],
            with: {
                organizer: true,
                category: true,
            },
            where: filters,
            limit: pageSize,
            offset: pageOffset,
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
            } satisfies z.infer<typeof eventSchema>;
        });

        return c.json({
            totalCount: eventCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            items: returnEvents,
        } satisfies z.infer<typeof ResponseSchema>);
    },
);
