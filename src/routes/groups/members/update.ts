import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

const updateMemberRoleSchema = z.object({
    role: z.enum(["member", "leader"]).meta({ description: "Membership role" }),
});

export const updateMemberRoleRoute = route().patch(
    "/:groupSlug/members/:userId",
    describeAuthenticatedRoute({
        tags: ["groups"],
        summary: "Update member role",
        operationId: "updateGroupMemberRole",
        description:
            "Update a member's role in a group. Requires 'groups:manage' permission.",
    })
        .response(200, "Member role updated successfully")
        .forbidden("Missing groups:manage permission")
        .notFound("Group, user, or membership not found")
        .build(),
    requireAuth,
    requirePermission("groups:manage"),
    validator("json", updateMemberRoleSchema),
    async (c) => {
        const body = c.req.valid("json");
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

        // Update role
        await db
            .update(schema.groupMembership)
            .set({
                role: body.role,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.groupMembership.userId, userId),
                    eq(schema.groupMembership.groupSlug, groupSlug),
                ),
            );

        return c.json(
            {
                message: "Member role updated successfully",
            },
            200,
        );
    },
);
