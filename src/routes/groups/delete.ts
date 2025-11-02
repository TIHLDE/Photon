import { eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requireOwnershipOrScopedPermission } from "~/middleware/ownership";
import { isGroupLeader } from "~/lib/group/middleware";

export const deleteRoute = route().delete(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Delete a group",
        description:
            "Delete a group by its slug. Requires being a group leader OR having 'groups:delete' permission (globally or scoped to this group). This action is irreversible and will remove all associated data, including memberships and fines.",
        responses: {
            204: {
                description: "Group successfully deleted",
            },
            403: {
                description: "Forbidden - Not a group leader or missing groups:delete permission",
            },
            404: {
                description:
                    "Not Found - Group with the specified slug does not exist",
            },
        },
    }),
    requireAuth,
    requireOwnershipOrScopedPermission(
        "slug",
        isGroupLeader,
        "groups:delete",
        (c) => `group:${c.req.param("slug")}`,
    ),
    async (c) => {
        const slug = c.req.param("slug");
        const { db } = c.get("ctx");

        // Check if the group exists
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, slug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        // Delete the group and all associated data (cascading handled by DB)
        await db.delete(schema.group).where(eq(schema.group.slug, slug));

        return c.body(null, 204);
    },
);
