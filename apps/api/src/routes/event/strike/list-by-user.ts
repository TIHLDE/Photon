import { getPermissionGroupScopes } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { and, desc, gte, inArray, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
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
import { strikesByUserResponseSchema } from "./schema";

export const listStrikesByUserRoute = route().get(
    "/strikes/members",
    describeRoute({
        tags: ["strikes"],
        summary: "List members with active strikes",
        operationId: "listStrikesByMember",
        description:
            "Retrieve members who currently have active strikes (prikker), each with the sum of their strikes and the strikes themselves. Paginates over members, not strikes, so a member's total is never split across pages. Requires 'events:strikes:view' or 'events:manage' permission; an organizer sees only the strikes from their own groups' events, and the total counts exactly those.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: strikesByUserResponseSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires events:strikes:view or events:manage",
        })
        .build(),
    requireAuth,
    requireAccess({
        permission: strikePermissions("view"),
        anyGroupScope: true,
    }),
    validator("query", PaginationSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const { pageSize, page } = c.req.valid("query");

        const scopes = await getPermissionGroupScopes(
            ctx,
            c.get("user").id,
            strikePermissions("view"),
        );

        /**
         * Same narrowing as the flat listing: a group-scoped grant sees the
         * prikker from that group's arrangementer and nothing else. The totals
         * below are summed over exactly the rows that survive this, so the
         * number on a closed accordion always matches the rows inside it.
         */
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
                                  : sql`false`,
                          ),
                  );

        const filters = and(
            gte(schema.eventStrike.createdAt, getStrikeActiveCutoff()),
            groupFilter,
        );

        const [{ count: totalCount } = { count: 0 }] = await db
            .select({
                count: sql<number>`count(distinct ${schema.eventStrike.userId})::int`,
            })
            .from(schema.eventStrike)
            .where(filters);

        // Medlemmene, ikke prikkene, er sidene her. Den som fikk en prikk sist
        // står øverst, slik den flate lista også sorterte.
        const members = await db
            .select({
                userId: schema.eventStrike.userId,
                total: sql<number>`sum(${schema.eventStrike.count})::int`,
                latest: sql<Date>`max(${schema.eventStrike.createdAt})`,
            })
            .from(schema.eventStrike)
            .where(filters)
            .groupBy(schema.eventStrike.userId)
            // Brukeren er med i sorteringen fordi to medlemmer kan ha fått
            // sin siste prikk i samme sekund — uten et fast tiebreak kan et
            // medlem dukke opp på to sider, eller falle mellom dem.
            .orderBy(
                sql`max(${schema.eventStrike.createdAt}) desc, ${schema.eventStrike.userId} asc`,
            )
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize));

        const userIds = members.map((member) => member.userId);

        const strikes =
            userIds.length === 0
                ? []
                : await db.query.eventStrike.findMany({
                      where: and(
                          filters,
                          inArray(schema.eventStrike.userId, userIds),
                      ),
                      orderBy: (s) => [desc(s.createdAt)],
                      with: {
                          user: {
                              columns: { id: true, name: true, image: true },
                          },
                          event: {
                              columns: { id: true, title: true, slug: true },
                          },
                      },
                  });

        const strikesByUser = new Map<string, typeof strikes>();
        for (const strike of strikes) {
            const rows = strikesByUser.get(strike.userId) ?? [];
            rows.push(strike);
            strikesByUser.set(strike.userId, rows);
        }

        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            members: members.flatMap((member) => {
                const rows = strikesByUser.get(member.userId) ?? [];
                const first = rows[0];

                // Uten en rad har vi ingen bruker å vise. Kan bare skje om en
                // prikk utløper mellom de to spørringene.
                if (!first) return [];

                return [
                    {
                        user: first.user,
                        totalStrikes: member.total,
                        strikes: rows.map((strike) => ({
                            id: strike.id,
                            userId: strike.userId,
                            eventId: strike.eventId,
                            count: strike.count,
                            reason: strike.reason,
                            createdAt: strike.createdAt.toISOString(),
                            user: strike.user,
                            event: strike.event,
                        })),
                    },
                ];
            }),
        });
    },
);
