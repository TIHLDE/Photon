import { schema } from "@photon/db";
import {
    and,
    asc,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lt,
    lte,
    sql,
} from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { captureAuth } from "../../middleware/auth";
import { route } from "../../lib/route";
import { getPageOffset, getTotalPages } from "../../middleware/pagination";
import {
    eventListFilterSchema,
    type eventListItemSchema,
    eventListResponseSchema,
} from "./schema";

type EventOrdering = z.infer<typeof eventListFilterSchema>["ordering"];

/**
 * Ordering for the event list.
 *
 * `upcoming` is what an admin wants by default: whatever is happening right now
 * or next sits on top, and everything already held follows below it with the
 * most recent first. A plain `asc(start)` cannot do that, since an ongoing event
 * started in the past — so the first key splits held from not-yet-held events,
 * and the two groups are then sorted in opposite directions.
 *
 * Without `ordering` the legacy behaviour is kept: ascending when the caller
 * asked for upcoming events only, descending otherwise.
 */
function buildOrderBy(ordering: EventOrdering, expired: boolean | undefined) {
    switch (ordering) {
        case "newest":
            return [desc(schema.event.start)];
        case "oldest":
            return [asc(schema.event.start)];
        case "upcoming":
            return [
                sql`${schema.event.end} < NOW()`,
                sql`CASE WHEN ${schema.event.end} >= NOW() THEN ${schema.event.start} END ASC NULLS LAST`,
                desc(schema.event.start),
            ];
        default:
            return expired === false
                ? [asc(schema.event.start)]
                : [desc(schema.event.start)];
    }
}

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
    captureAuth,
    validator("query", eventListFilterSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const {
            page,
            pageSize,
            search,
            expired,
            openSignUp,
            category,
            ordering,
        } = c.req.valid("query");

        // Members-only events are hidden from unauthenticated (non-member)
        // callers. Any authenticated user counts as a member.
        const isMember = !!c.get("user");

        const filters = and(
            ...[
                isMember ? undefined : eq(schema.event.visibility, "public"),
                search ? ilike(schema.event.title, `%${search}%`) : undefined,
                category
                    ? inArray(schema.event.categorySlug, category)
                    : undefined,
                expired != null
                    ? expired
                        ? lt(schema.event.end, sql`NOW()`)
                        : gte(schema.event.end, sql`NOW()`)
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
            orderBy: buildOrderBy(ordering, expired),
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
                imageAlt: e.imageAlt,
                createdAt: e.createdAt.toISOString(),
                updatedAt: e.updatedAt.toISOString(),
                category: {
                    slug: e.category.slug,
                    label: e.category.label,
                },
                visibility: e.visibility,
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
