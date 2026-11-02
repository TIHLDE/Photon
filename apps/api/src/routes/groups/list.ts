import { schema } from "@photon/db";
import { EmptyFilter, count } from "drizzle-orm";
import { validator } from "hono-openapi";
import { canViewGroup } from "~/lib/group";
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
            "Retrieve the active groups, or with `archived=true` the archived ones — an archived private group only to those who may open it: its members and 'groups:manage' (global or scoped to the group). Supports optional filtering by type and search query.",
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

        const found = await db.query.group.findMany({
            where: {
                archivedAt:
                    archived === "true"
                        ? { isNotNull: true }
                        : { isNull: true },
                OR: searchQuery
                    ? [
                          { name: { ilike: `%${searchQuery}%` } },
                          { description: { ilike: `%${searchQuery}%` } },
                      ]
                    : EmptyFilter,
                type: typeFilter ? typeFilter : EmptyFilter,
            },
            orderBy: { name: "asc" },
        });

        // Archived groups are open to everyone, except a private one, which
        // stays with whoever may open its page. Asked through the very check
        // the page uses, so the list never offers a group the page refuses,
        // nor hides one it would open. Archived private groups are few, so
        // the per-group check is cheap.
        const userId = c.get("user")?.id;
        const groups =
            archived === "true"
                ? (
                      await Promise.all(
                          found.map(async (group) =>
                              (await canViewGroup(ctx, group, userId))
                                  ? group
                                  : null,
                          ),
                      )
                  ).filter((group) => group !== null)
                : found;

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
