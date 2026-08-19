import { getPermissionGroupScopes } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { strikePermissions } from "~/lib/event/access";
import { getStrikeActiveCutoff } from "~/lib/event/strikes";
import { strikeListResponseSchema } from "./schema";

const requireStrikePermission = requireAccess({
    // Coarse gate only: a group-scoped grant is enough to have prikker to
    // read, and the handler narrows the listing to exactly those groups.
    permission: strikePermissions("view"),
    anyGroupScope: true,
});

/**
 * Everyone may read their own prikker — `?userId=<seg selv>` needs no grant.
 * Anything wider (all strikes, or someone else's) still requires
 * `events:strikes:view`, or the right to arrange the events they came from.
 * Without this, the "Prikker" page on a member's own profile could never load
 * anything.
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
        const ctx = c.get("ctx");
        const { db } = ctx;
        const { pageSize, page, userId } = c.req.valid("query");
        const isOwnStrikes = userId === c.get("user").id;

        const pageOffset = getPageOffset(page, pageSize);
        // Only list strikes that are still active (not expired / not aged out
        // past the freeze-adjusted 20-day window).
        const activeCutoff = getStrikeActiveCutoff();

        /**
         * Narrow to the groups whose arrangementer the reader answers for.
         *
         * The gate above accepts a group-scoped grant, so without this a NoK
         * verv would open every group's prikker at once. Reading your own is
         * never narrowed — that branch skips the gate entirely.
         */
        const scopes = isOwnStrikes
            ? "*"
            : await getPermissionGroupScopes(
                  ctx,
                  c.get("user").id,
                  strikePermissions("view"),
              );

        const groupFilter =
            scopes === "*"
                ? undefined
                : inArray(
                      schema.eventStrike.eventId,
                      db
                          .select({ id: schema.event.id })
                          .from(schema.event)
                          .where(
                              scopes.length > 0
                                  ? inArray(
                                        schema.event.organizerGroupSlug,
                                        scopes,
                                    )
                                  : // No group at all: match nothing rather
                                    // than everything.
                                    sql`false`,
                          ),
                  );

        const filters = and(
            gte(schema.eventStrike.createdAt, activeCutoff),
            userId ? eq(schema.eventStrike.userId, userId) : undefined,
            groupFilter,
        );

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
            nextPage: getNextPage(page, totalPages),
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
