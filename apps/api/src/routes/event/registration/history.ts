import { schema } from "@photon/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { myEventHistorySchema } from "../schema";

/**
 * The events the caller has actually been to. Cancelled and pending
 * registrations are left out — those never became attendance — and the list
 * stops at events that have already ended, so it reads as a history rather
 * than a mix of past and upcoming.
 */
export const getMyEventHistoryRoute = route().get(
    "/my-registrations",
    describeRoute({
        tags: ["events"],
        summary: "Get my past event registrations",
        operationId: "getMyEventHistory",
        description:
            "Retrieve a paginated list of past events you were registered for, newest first.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: myEventHistorySchema,
            description: "OK",
        })
        .build(),
    requireAuth,
    validator("query", PaginationSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const userId = c.get("user").id;
        const { page, pageSize } = c.req.valid("query");

        const filters = and(
            eq(schema.eventRegistration.userId, userId),
            inArray(schema.eventRegistration.status, [
                "registered",
                "attended",
                "no_show",
            ]),
            lt(schema.event.end, new Date()),
        );

        const rows = await db
            .select({
                eventId: schema.event.id,
                title: schema.event.title,
                slug: schema.event.slug,
                startTime: schema.event.start,
                status: schema.eventRegistration.status,
            })
            .from(schema.eventRegistration)
            .innerJoin(
                schema.event,
                eq(schema.eventRegistration.eventId, schema.event.id),
            )
            .where(filters)
            .orderBy(desc(schema.event.start))
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize));

        const totalCount = await db
            .select({ id: schema.event.id })
            .from(schema.eventRegistration)
            .innerJoin(
                schema.event,
                eq(schema.eventRegistration.eventId, schema.event.id),
            )
            .where(filters)
            .then((res) => res.length);

        const pages = getTotalPages(totalCount, pageSize);

        const response: z.infer<typeof myEventHistorySchema> = {
            totalCount,
            pages,
            nextPage: page + 1 < pages ? page + 1 : null,
            events: rows.map((row) => ({
                eventId: row.eventId,
                title: row.title,
                slug: row.slug,
                startTime: row.startTime.toISOString(),
                status: row.status as "registered" | "attended" | "no_show",
            })),
        };

        return c.json(response, 200);
    },
);
