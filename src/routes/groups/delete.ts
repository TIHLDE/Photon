import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "~/db";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requireOwnershipOrScopedPermission } from "~/middleware/ownership";

export const deleteRoute = route().delete(
    "/:slug",
    describeAuthenticatedRoute({
        tags: ["groups"],
        summary: "Delete a group",
        operationId: "deleteGroup",
        description:
            "Delete a group by its slug. Requires being a group leader OR having 'groups:delete' permission (globally or scoped to this group). This action is irreversible and will remove all associated data, including memberships and fines.",
    })
        .response(204, "Group successfully deleted")
        .forbidden("Not a group leader or missing groups:delete permission")
        .notFound("Group with the specified slug does not exist")
        .build(),
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
