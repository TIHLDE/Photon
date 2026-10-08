import { schema } from "@photon/db";
import { type SQL, and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { userImageExtra } from "~/lib/user/avatar";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import {
    canViewFines,
    requireFinesGroup,
    wasEverGroupMember,
} from "./permissions";
import { fineListResponseSchema, fineStatusSchema } from "./schema";
import { serializeFineLaw } from "./serialize";

export const listFinesRoute = route().get(
    "/:groupSlug/fines",
    describeRoute({
        tags: ["fines"],
        summary: "List fines for a group",
        operationId: "listFines",
        description:
            "Retrieve a paginated list of fines for a group, newest first. Group members can view all fines in their own group (Lepton parity), as can the fines admin and root. A former member sees only the fines they are party to: the ones they received and the ones they handed out. Anyone who never belonged to the group is refused. Filter with 'status' and 'userId'. Use 'aroundFineId' as a jump hint within the visible, filtered list; it takes precedence over 'page'. A missing or nonmatching target returns the first page without changing the filters.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineListResponseSchema,
            description: "List of fines retrieved successfully",
        })
        .forbidden({
            description: "Never belonged to this group",
        })
        .notFound({
            description: "Group not found, or fines not activated",
        })
        .build(),
    requireAuth,
    validator(
        "query",
        PaginationSchema.extend({
            status: fineStatusSchema
                .or(z.literal("active"))
                .optional()
                .describe(
                    "Only return fines with this status; 'active' includes pending and approved",
                ),
            userId: z
                .string()
                .optional()
                .describe("Only return fines given to this user"),
            aroundFineId: z
                .uuid()
                .optional()
                .describe(
                    "Jump to this fine within the authorized, filtered list, or return the first page if it does not match",
                ),
        }),
    ),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");
        const { page, pageSize, status, userId, aroundFineId } =
            c.req.valid("query");

        const group = await requireFinesGroup(ctx, groupSlug);

        const conditions: (SQL | undefined)[] = [
            eq(schema.fine.groupSlug, groupSlug),
        ];

        /**
         * Reading the group's whole botliste is for the group: members, the
         * botsjef, root. A former member is narrowed to the fines they are
         * party to rather than turned away.
         *
         * That narrowing is what being removed leaves them with, and they need
         * it. Leaving the group ends their bøter there — the unpaid total
         * stops counting them — but the ones already handed out stay theirs to
         * look up: what they were fined for and still owe, and what they
         * handed out to others while they were in the group. Being removed
         * should not black out your own record, and a botsjef fielding "hva
         * var det jeg fikk bot for?" should not be the only way to read it.
         *
         * Having belonged to the group is the price of entry, though. Bøter
         * are internal, so someone who never was a member is refused outright
         * rather than handed an empty list.
         */
        if (!(await canViewFines(ctx, user.id, group))) {
            if (!(await wasEverGroupMember(ctx, user.id, groupSlug))) {
                throw new HTTPException(403, {
                    message: "Not authorized to view fines for this group",
                });
            }

            conditions.push(
                or(
                    eq(schema.fine.userId, user.id),
                    eq(schema.fine.createdByUserId, user.id),
                ),
            );
        }

        if (userId) {
            conditions.push(eq(schema.fine.userId, userId));
        }

        if (status) {
            conditions.push(
                status === "active"
                    ? inArray(schema.fine.status, ["pending", "approved"])
                    : eq(schema.fine.status, status),
            );
        }

        const filters = and(...conditions);
        let resolvedPage = page;
        if (aroundFineId) {
            // Keep the tuple comparison in PostgreSQL: JS Date would lose
            // microseconds and could put a boundary fine on the wrong page.
            // An invisible/nonmatching target yields no tuple, so the count
            // is zero and we fall back to the filtered first page.
            const precedingCount = await db.$count(
                schema.fine,
                and(
                    filters,
                    sql`(${schema.fine.createdAt}, ${schema.fine.id}) > (
                        SELECT ${schema.fine.createdAt}, ${schema.fine.id}
                        FROM ${schema.fine}
                        WHERE ${schema.fine.id} = ${aroundFineId} AND ${filters}
                    )`,
                ),
            );
            resolvedPage = Math.floor(precedingCount / pageSize);
        }
        const totalCount = await db.$count(schema.fine, filters);

        // Include public user info (name/image) so the UI can display names
        // instead of user IDs
        const fines = await db.query.fine.findMany({
            where: filters,
            // The ID breaks timestamp ties, including bulk-created fines.
            orderBy: [desc(schema.fine.createdAt), desc(schema.fine.id)],
            limit: pageSize,
            offset: getPageOffset(resolvedPage, pageSize),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                    },
                    extras: userImageExtra,
                },
                createdByUser: {
                    columns: {
                        id: true,
                        name: true,
                    },
                    extras: userImageExtra,
                },
                // The paragraph the fine cites, so the list can show
                // "3.10 - Møtte ikke opp" instead of the bare reason.
                law: {
                    columns: {
                        id: true,
                        paragraph: true,
                        title: true,
                    },
                },
            },
        });

        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            page: resolvedPage,
            nextPage: getNextPage(resolvedPage, totalPages),
            fines: fines.map(serializeFineLaw),
        });
    },
);
