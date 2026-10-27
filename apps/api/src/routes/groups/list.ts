import { schema } from "@photon/db";
import { hasPermission } from "@photon/auth/rbac";
import {
    and,
    asc,
    count,
    eq,
    ilike,
    inArray,
    isNotNull,
    isNull,
    notIlike,
    or,
} from "drizzle-orm";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import { groupListSchema, listGroupsQuerySchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["groups"],
        summary: "List groups",
        operationId: "listGroups",
        description:
            "Retrieve the active groups, or with `archived=true` the archived ones — an archived private group only to its members and 'groups:manage'. Supports optional filtering by type and search query.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: groupListSchema,
            description: "List of groups retrieved successfully",
        })
        .build(),
    captureAuth,
    validator("query", listGroupsQuerySchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const {
            search: searchQuery,
            type: typeFilter,
            archived,
        } = c.req.valid("query");

        const conditions = [];

        if (archived === "true") {
            conditions.push(isNotNull(schema.group.archivedAt));

            // Archived groups are open to everyone, except a private one,
            // which stays with its members — see `canViewGroup`.
            const userId = c.get("user")?.id;
            if (
                !userId ||
                !(await hasPermission(ctx, userId, "groups:manage"))
            ) {
                conditions.push(
                    or(
                        notIlike(schema.group.type, "private"),
                        userId
                            ? inArray(
                                  schema.group.slug,
                                  db
                                      .select({
                                          slug: schema.groupMembership
                                              .groupSlug,
                                      })
                                      .from(schema.groupMembership)
                                      .where(
                                          eq(
                                              schema.groupMembership.userId,
                                              userId,
                                          ),
                                      ),
                              )
                            : undefined,
                    ),
                );
            }
        } else {
            conditions.push(isNull(schema.group.archivedAt));
        }

        // Add search filter if provided
        if (searchQuery) {
            conditions.push(
                or(
                    ilike(schema.group.name, `%${searchQuery}%`),
                    ilike(schema.group.description, `%${searchQuery}%`),
                ),
            );
        }

        // Add type filter if provided
        if (typeFilter) {
            conditions.push(eq(schema.group.type, typeFilter));
        }

        const groups = await db.query.group.findMany({
            where: and(...conditions),
            orderBy: [asc(schema.group.name)],
        });

        // Fetch member counts in one aggregated query instead of per group
        const memberCounts = await db
            .select({
                groupSlug: schema.groupMembership.groupSlug,
                memberCount: count(),
            })
            .from(schema.groupMembership)
            .groupBy(schema.groupMembership.groupSlug);
        const countBySlug = new Map(
            memberCounts.map((row) => [row.groupSlug, row.memberCount]),
        );

        return c.json(
            groups.map((group) => ({
                ...group,
                memberCount: countBySlug.get(group.slug) ?? 0,
            })),
        );
    },
);
