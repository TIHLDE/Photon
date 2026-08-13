import { schema } from "@photon/db";
import { and, desc, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
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
import { fineListResponseSchema, fineStatusSchema } from "./schema";
import { serializeFineLaw } from "./serialize";

export const listFinesRoute = route().get(
    "/:groupSlug/fines",
    describeRoute({
        tags: ["fines"],
        summary: "List fines for a group",
        operationId: "listFines",
        description:
            "Retrieve a paginated list of fines for a group, newest first. Group members can view all fines in their own group (Lepton parity), as can the fines admin and root. Filter with 'status' and 'userId'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineListResponseSchema,
            description: "List of fines retrieved successfully",
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
                .describe("Only return fines with this status"),
            userId: z
                .string()
                .optional()
                .describe("Only return fines given to this user"),
        }),
    ),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");
        const { page, pageSize, status, userId } = c.req.valid("query");

        const group = await requireFinesGroup(ctx, groupSlug);

        if (!(await canViewFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to view fines for this group",
            });
        }

        const conditions = [eq(schema.fine.groupSlug, groupSlug)];

        if (userId) {
            conditions.push(eq(schema.fine.userId, userId));
        }

        if (status) {
            conditions.push(eq(schema.fine.status, status));
        }

        const filters = and(...conditions);
        const totalCount = await db.$count(schema.fine, filters);

        // Include public user info (name/image) so the UI can display names
        // instead of user IDs
        const fines = await db.query.fine.findMany({
            where: filters,
            orderBy: desc(schema.fine.createdAt),
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                createdByUser: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
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
            nextPage: getNextPage(page, totalPages),
            fines: fines.map(serializeFineLaw),
        });
    },
);
