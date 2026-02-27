import { schema } from "@photon/db";
import { and, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "../../lib/route";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "../../middleware/pagination";
import { eventListFilterSchema, eventListItemSchema, eventListResponseSchema } from "./schema";

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
            schema: eventListResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", eventListFilterSchema),
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
            } satisfies z.infer<typeof eventListItemSchema>;
        });

        return c.json({
            totalCount: eventCount,
            pages: totalPages,
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items: returnEvents,
        } satisfies z.infer<typeof eventListResponseSchema>);
    },
);
