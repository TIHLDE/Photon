import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

export const removeMemberRoute = route().delete(
    "/:groupSlug/members/:userId",
    describeAuthenticatedRoute({
        tags: ["groups"],
        summary: "Remove member from group",
        operationId: "removeGroupMember",
        description:
            "Remove a member from a group. Requires 'groups:manage' permission.",
    })
        .response(204, "Member removed successfully")
        .forbidden("Missing groups:manage permission")
        .notFound("Group, user, or membership not found")
        .build(),
    requireAuth,
    requirePermission("groups:manage"),
    async (c) => {
        const groupSlug = c.req.param("groupSlug");
        const userId = c.req.param("userId");
        const { db } = c.get("ctx");

        // Validate group exists
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        // Check if membership exists
        const membership = await db
            .select()
            .from(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.userId, userId),
                    eq(schema.groupMembership.groupSlug, groupSlug),
                ),
            )
            .limit(1)
            .then((res) => res[0]);

        if (!membership) {
            throw new HTTPException(404, {
                message: `User "${userId}" is not a member of group "${groupSlug}"`,
            });
        }

        // Remove membership
        await db
            .delete(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.userId, userId),
                    eq(schema.groupMembership.groupSlug, groupSlug),
                ),
            );

        return c.body(null, 204);
    },
);
