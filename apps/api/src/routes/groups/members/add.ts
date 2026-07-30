import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { addUserToGroup, isDerivedGroupType } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { isGroupLeader } from "~/lib/group/middleware";
import { requireAuth } from "~/middleware/auth";
import { addMemberSchema, membershipResponseSchema } from "../schema";

export const addMemberRoute = route().post(
    "/:groupSlug/members",
    describeRoute({
        tags: ["groups"],
        summary: "Add member to group",
        operationId: "addGroupMember",
        description:
            "Add a member to a group. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: membershipResponseSchema,
            description: "Member added successfully",
        })
        .badRequest({ description: "User already a member or user not found" })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    // A group's leader manages their own roster; "groups:manage" scoped to the
    // group does the same for anyone else. Derived (Feide) groups are refused
    // further down regardless of who asks.
    requireAccess({
        permission: "groups:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    validator("json", addMemberSchema),
    async (c) => {
        const body = c.req.valid("json");
        const groupSlug = c.req.param("groupSlug");
        const ctx = c.get("ctx");
        const { db } = ctx;

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

        // Validate user exists
        const user = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, body.userId))
            .limit(1)
            .then((res) => res[0]);

        if (!user) {
            throw new HTTPException(400, {
                message: `User with ID "${body.userId}" not found`,
            });
        }

        // Check if already a member
        const existingMembership = await db
            .select()
            .from(schema.groupMembership)
            .where(
                and(
                    eq(schema.groupMembership.userId, body.userId),
                    eq(schema.groupMembership.groupSlug, groupSlug),
                ),
            )
            .limit(1);

        if (existingMembership.length > 0) {
            throw new HTTPException(400, {
                message: `User is already a member of group "${groupSlug}"`,
            });
        }

        // Handing out leadership is an escalation — a subgroup leader also
        // gets the leader role and a seat in HS — so it stays with
        // "groups:manage". A group's own leader may add plain members only.
        if (body.role === "leader" && c.get("isResourceOwner")) {
            throw new HTTPException(403, {
                message:
                    "Adding a member as leader requires the 'groups:manage' permission",
            });
        }

        // Add membership. Goes through the helper so the group's associated RBAC
        // role (group.roleId) is auto-assigned along with it.
        const membership = await addUserToGroup(
            ctx,
            body.userId,
            groupSlug,
            body.role,
        );

        return c.json(membership, 201);
    },
);
