import { schema } from "@photon/db";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { myUpcomingEventsSchema } from "../schema";

/**
 * Everything the caller is signed up for that has not happened yet — the
 * counterpart to `/my-registrations`, which stops at events that are over.
 * Waitlisted and pending registrations are included: from the member's side
 * those are still something they signed up for and need to keep an eye on.
 * Nothing filters on category, so activities show up alongside the rest.
 */
export const getMyUpcomingEventsRoute = route().get(
    "/my-upcoming-registrations",
    describeRoute({
        tags: ["events"],
        summary: "Get my upcoming event registrations",
        operationId: "getMyUpcomingEvents",
        description:
            "Retrieve the events you are registered, waitlisted or pending for that have not ended yet, soonest first.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: myUpcomingEventsSchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;

        const rows = await db
            .select({
                eventId: schema.event.id,
                title: schema.event.title,
                slug: schema.event.slug,
                startTime: schema.event.start,
                endTime: schema.event.end,
                categorySlug: schema.event.categorySlug,
                location: schema.event.location,
                image: schema.event.imageUrl,
                imageAlt: schema.event.imageAlt,
                organizer: schema.group.name,
                status: schema.eventRegistration.status,
                waitlistPosition: schema.eventRegistration.waitlistPosition,
            })
            .from(schema.eventRegistration)
            .innerJoin(
                schema.event,
                eq(schema.eventRegistration.eventId, schema.event.id),
            )
            // Left join: an event without an organizing group still belongs in
            // the list, it just has no badge.
            .leftJoin(
                schema.group,
                eq(schema.event.organizerGroupSlug, schema.group.slug),
            )
            .where(
                and(
                    eq(schema.eventRegistration.userId, userId),
                    inArray(schema.eventRegistration.status, [
                        "registered",
                        "waitlisted",
                        "pending",
                    ]),
                    gte(schema.event.end, new Date()),
                ),
            )
            .orderBy(asc(schema.event.start));

        const response: z.infer<typeof myUpcomingEventsSchema> = rows.map(
            (row) => ({
                eventId: row.eventId,
                title: row.title,
                slug: row.slug,
                startTime: row.startTime.toISOString(),
                endTime: row.endTime.toISOString(),
                categorySlug: row.categorySlug,
                location: row.location,
                image: row.image,
                imageAlt: row.imageAlt,
                organizer: row.organizer,
                status: row.status as "registered" | "waitlisted" | "pending",
                waitlistPosition: row.waitlistPosition,
            }),
        );

        return c.json(response, 200);
    },
);
