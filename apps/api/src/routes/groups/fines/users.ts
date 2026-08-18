import { schema } from "@photon/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { canViewFines, requireFinesGroup } from "./permissions";
import { fineStatusSchema, fineUserListResponseSchema } from "./schema";

export const listFineUsersRoute = route().get(
    "/:groupSlug/fines/users",
    describeRoute({
        tags: ["fines"],
        summary: "List a group's members with their fine totals",
        operationId: "listFineUsers",
        description:
            "Paginated list of the group's members with the sum of their active fine amounts, highest first. Active means not settled: fines awaiting approval and approved but unpaid ones. Paid and rejected fines are left out unless 'status' asks for them. Members without active fines are included with a total of 0.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineUserListResponseSchema,
            description: "Members with fine totals retrieved successfully",
        })
        .forbidden({
            description: "Not authorized to view fines for this group",
        })
        .notFound({
            description: "Group not found, or fines not activated for it",
        })
        .build(),
    requireAuth,
    validator(
        "query",
        PaginationSchema.extend({
            status: fineStatusSchema
                .optional()
                .describe(
                    "Only count fines with this status, instead of the active ones",
                ),
        }),
    ),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");
        const { page, pageSize, status } = c.req.valid("query");

        const group = await requireFinesGroup(ctx, groupSlug);

        if (!(await canViewFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to view fines for this group",
            });
        }

        /**
         * Lepton parity: the list is driven by the membership table, not by the
         * fines, so a member who has stayed out of trouble still shows up with
         * 0. That is what makes "per medlem" a roster rather than a rap sheet.
         *
         * Without a status filter only the active fines count: the ones that
         * have not been settled. Paid fines are history and rejected ones never
         * happened, and counting both inflated the number a botsjef reads as
         * "who owes something right now".
         */
        const fineJoin = and(
            eq(schema.fine.userId, schema.groupMembership.userId),
            eq(schema.fine.groupSlug, groupSlug),
            status
                ? eq(schema.fine.status, status)
                : inArray(schema.fine.status, ["pending", "approved"]),
        );

        const totalCount = await db.$count(
            schema.groupMembership,
            eq(schema.groupMembership.groupSlug, groupSlug),
        );

        const finesAmount = sql<number>`coalesce(sum(${schema.fine.amount}), 0)::int`;
        const finesCount = sql<number>`count(${schema.fine.id})::int`;

        const rows = await db
            .select({
                id: schema.user.id,
                name: schema.user.name,
                image: schema.user.image,
                finesAmount,
                finesCount,
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.user,
                eq(schema.user.id, schema.groupMembership.userId),
            )
            .leftJoin(schema.fine, fineJoin)
            .where(eq(schema.groupMembership.groupSlug, groupSlug))
            .groupBy(schema.user.id, schema.user.name, schema.user.image)
            // Lepton left this unordered, which makes paging skip and repeat
            // rows. Name breaks ties so the order is total.
            .orderBy(desc(finesAmount), asc(schema.user.name))
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize));

        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            users: rows,
        });
    },
);
