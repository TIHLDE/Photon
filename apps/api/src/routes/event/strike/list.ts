import { schema } from "@photon/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { getStrikeActiveCutoff } from "~/lib/event/strikes";
import { strikeListResponseSchema } from "./schema";

const requireStrikePermission = requireAccess({
    permission: ["events:strikes:view", "events:manage"],
});

/**
 * Everyone may read their own prikker — `?userId=<seg selv>` needs no grant.
 * Anything wider (all strikes, or someone else's) still requires
 * `events:strikes:view` / `events:manage`. Without this, the "Prikker" page on
 * a member's own profile could never load anything.
 */
const requireStrikeAccess = createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (user && c.req.query("userId") === user.id) {
        await next();
        return;
    }
    return requireStrikePermission(c, next);
});

export const listStrikesRoute = route().get(
    "/strikes",
    describeRoute({
        tags: ["strikes"],
        summary: "List strikes",
        operationId: "listStrikes",
        description:
            "Retrieve a paginated list of all strikes (prikker), including the affected user and the related event. Optionally filter by user. Requires 'events:strikes:view' or 'events:manage' permission, except when filtering on your own user ID.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: strikeListResponseSchema,
            description: "OK",
        })
        .forbidden({
            description:
                "Requires events:strikes:view or events:manage permission, unless reading your own strikes",
        })
        .build(),
    requireAuth,
    requireStrikeAccess,
    validator(
        "query",
        PaginationSchema.extend({
            userId: z.string().optional().describe("Filter strikes by user ID"),
        }),
    ),
    async (c) => {
        const { db } = c.get("ctx");
        const { pageSize, page, userId } = c.req.valid("query");

        const pageOffset = getPageOffset(page, pageSize);
        // Only list strikes that are still active (not expired / not aged out
        // past the freeze-adjusted 20-day window).
        const activeCutoff = getStrikeActiveCutoff();
        const filters = userId
            ? and(
                  eq(schema.eventStrike.userId, userId),
                  gte(schema.eventStrike.createdAt, activeCutoff),
              )
            : gte(schema.eventStrike.createdAt, activeCutoff);

        const totalCount = await db.$count(schema.eventStrike, filters);

        const strikes = await db.query.eventStrike.findMany({
            where: filters,
            orderBy: (s) => [desc(s.createdAt)],
            limit: pageSize,
            offset: pageOffset,
            with: {
                user: {
                    columns: { id: true, name: true, image: true },
                },
                event: {
                    columns: { id: true, title: true, slug: true },
                },
            },
        });

        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            strikes: strikes.map((strike) => ({
                id: strike.id,
                userId: strike.userId,
                eventId: strike.eventId,
                count: strike.count,
                reason: strike.reason,
                createdAt: strike.createdAt.toISOString(),
                user: strike.user,
                event: strike.event,
            })),
        } satisfies z.infer<typeof strikeListResponseSchema>);
    },
);
