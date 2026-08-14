import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    addUserToGroup,
    allowsNonMemberLeader,
    isDerivedGroupType,
    updateGroupMemberRole,
} from "~/lib/group";
import { isGroupLeader } from "~/lib/group/middleware";
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
            "Update a member's role in a group. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader — a sitting leader may only hand the leadership over to someone else.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: updateMemberRoleResponseSchema,
            description: "Member role updated successfully",
        })
        .notFound({ description: "Group, user, or membership not found" })
        .build(),
    requireAuth,
    // Scoped like add/remove: a `groups:manage` grant for this group counts,
    // and the sitting leader owns the handover of their own verv. What the
    // leader may do through that ownership is narrowed in the handler: only
    // appointing someone else as leader, never setting members down.
    requireAccess({
        permission: "groups:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    validator("json", updateMemberRoleSchema),
    async (c) => {
        const body = c.req.valid("json");
        const groupSlug = c.req.param("groupSlug");
        const userId = c.req.param("userId");
        const ctx = c.get("ctx");
        const { db } = ctx;
        // True only when the request got through on leadership alone; anyone
        // holding "groups:manage" for the group lands here with `false`.
        const asSittingLeader = c.get("isResourceOwner") === true;

        if (asSittingLeader) {
            // Overføring, ikke rosettdeling: lederen kan peke ut sin
            // etterfølger, men ikke sette medlemmer opp og ned ellers — og
            // ikke legge ned ledervervet uten å gi det videre.
            if (body.role !== "leader") {
                throw new HTTPException(403, {
                    message:
                        "Changing a member's role requires the 'groups:manage' permission",
                });
            }
            if (userId === c.get("user")?.id) {
                throw new HTTPException(400, {
                    message: "You are already the leader of this group",
                });
            }
        }

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
            // Presidenten er ikke medlem av HS før hun blir valgt, så der kan
            // ledervervet gis til hvem som helst — medlemskapet opprettes som
            // en del av overføringen. Alle andre grupper velger lederen sin
            // blant sine egne medlemmer.
            if (body.role !== "leader" || !allowsNonMemberLeader(group)) {
                throw new HTTPException(404, {
                    message: `User "${userId}" is not a member of group "${groupSlug}"`,
                });
            }

            const incoming = await db
                .select({ id: schema.user.id })
                .from(schema.user)
                .where(eq(schema.user.id, userId))
                .limit(1)
                .then((res) => res[0]);

            if (!incoming) {
                throw new HTTPException(404, {
                    message: `User with ID "${userId}" not found`,
                });
            }

            // Legger inn som leder direkte: helperen setter den sittende
            // lederen ned og holder HS-synkingen i orden, akkurat som
            // updateGroupMemberRole gjør nedenfor.
            await addUserToGroup(ctx, userId, groupSlug, "leader");

            return c.json({ message: "Member role updated successfully" }, 200);
        }

        // Goes through the helper rather than a bare UPDATE: it sets the
        // sitting leader down (a group has one leader) and keeps the HS seat
        // for subgroup leaders in sync.
        await updateGroupMemberRole(ctx, userId, groupSlug, body.role);

        return c.json(
            {
                message: "Member role updated successfully",
            },
            200,
        );
    },
);
