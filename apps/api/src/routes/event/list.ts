import { schema } from "@photon/db";
import {
    EmptyFilter,
    and,
    asc,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    isNull,
    lt,
    lte,
    or,
    sql,
} from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { isMemberAudience } from "~/lib/auth";
import { describeRoute } from "~/lib/openapi";
import { captureAuth } from "../../middleware/auth";
import { route } from "../../lib/route";
import {
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "../../middleware/pagination";
import {
    eventListFilterSchema,
    type eventListItemSchema,
    eventListResponseSchema,
} from "./schema";

type EventTable = typeof schema.event;

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
function buildOrderBy(
    event: EventTable,
    ordering: EventOrdering,
    expired: boolean | undefined,
) {
    // Several events share a start time, and without a unique last key Postgres
    // may order ties differently per query, so offset pages overlap or skip rows.
    return [...buildPrimaryOrder(event, ordering, expired), asc(event.id)];
}

function buildPrimaryOrder(
    event: EventTable,
    ordering: EventOrdering,
    expired: boolean | undefined,
) {
    switch (ordering) {
        case "newest":
            return [desc(event.start)];
        case "oldest":
            return [asc(event.start)];
        case "upcoming":
            return [
                sql`${event.end} < NOW()`,
                sql`CASE WHEN ${event.end} >= NOW() THEN ${event.start} END ASC NULLS LAST`,
                desc(event.start),
            ];
        default:
            return expired === false ? [asc(event.start)] : [desc(event.start)];
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
            organizerGroupSlug,
            ordering,
            startFrom,
            startBefore,
        } = c.req.valid("query");

        // Members-only events are hidden from callers who are not members.
        // Being signed in is not enough on its own: anyone may sign themselves
        // up on the website, and until an admin approves them they see exactly
        // what a visitor sees.
        const isMember = isMemberAudience(c.get("user"));

        const filters = (event: EventTable) =>
            and(
                ...[
                    isMember ? undefined : eq(event.visibility, "public"),
                    search ? ilike(event.title, `%${search}%`) : undefined,
                    category
                        ? inArray(event.categorySlug, category)
                        : undefined,
                    organizerGroupSlug
                        ? eq(event.organizerGroupSlug, organizerGroupSlug)
                        : undefined,
                    startFrom
                        ? gte(event.start, new Date(startFrom))
                        : undefined,
                    startBefore
                        ? lt(event.start, new Date(startBefore))
                        : undefined,
                    expired != null
                        ? expired
                            ? lt(event.end, sql`NOW()`)
                            : gte(event.end, sql`NOW()`)
                        : undefined,
                    // Påmeldingen er åpen når vinduet omslutter nå-tidspunktet:
                    // den har startet og ikke gått ut. Begge grensene er
                    // nullbare og betyr da «ingen grense» — åpnet med én gang,
                    // respektive ingen frist — så de teller som innenfor.
                    // `isRegistrationClosed` overstyrer vinduet, slik den gjør
                    // ellers i arrangementslogikken.
                    openSignUp === true
                        ? and(
                              eq(event.requiresSigningUp, true),
                              eq(event.isRegistrationClosed, false),
                              or(
                                  isNull(event.registrationStart),
                                  lte(event.registrationStart, sql`NOW()`),
                              ),
                              or(
                                  isNull(event.registrationEnd),
                                  gte(event.registrationEnd, sql`NOW()`),
                              ),
                          )
                        : undefined,
                ].filter(Boolean),
            );

        const eventCount = await db.$count(schema.event, filters(schema.event));

        const pageOffset = getPageOffset(page, pageSize);
        const totalPages = getTotalPages(eventCount, pageSize);

        const events = await db.query.event.findMany({
            orderBy: (event) => buildOrderBy(event, ordering, expired),
            with: {
                organizer: true,
                category: true,
            },
            where: { RAW: (event) => filters(event) ?? EmptyFilter },
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
                createdById: e.createdByUserId,
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
            nextPage: getNextPage(page, totalPages),
            items: returnEvents,
        } satisfies z.infer<typeof eventListResponseSchema>);
    },
);
