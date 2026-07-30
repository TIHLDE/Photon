import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { isDerivedGroupType } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    updateMemberRoleResponseSchema,
    updateMemberRoleSchema,
} from "../schema";

export const updateMemberRoleRoute = route().patch(
    "/:groupSlug/members/:userId",
    describeRoute({
        tags: ["groups"],
        summary: "Update member role",
        operationId: "updateGroupMemberRole",
        description:
            "Update a member's role in a group. Requires 'groups:manage' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateMemberRoleResponseSchema,
            description: "Member role updated successfully",
        })
        .notFound({ description: "Group, user, or membership not found" })
        .build(),
    requireAuth,
    // Scoped like add/remove: a `groups:manage` grant for this group counts.
    // Unlike those two there is no leader ownership — appointing the next
    // leader is not the sitting leader's own call, matching how adding a
    // member AS leader is refused further down in members/add.ts.
    requireAccess({
        permission: "groups:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
    }),
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

        if (isDerivedGroupType(group.type)) {
            throw new HTTPException(400, {
                message: `Membership of "${groupSlug}" follows the member's Feide study programme and cannot be edited directly`,
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
