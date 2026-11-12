import { hasScopedPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    addUserToGroup,
    allowsMultipleLeaders,
    allowsNonMemberLeader,
    isDerivedGroupType,
    updateGroupMemberRole,
} from "~/lib/group";
import { isGroupLeader } from "~/lib/group/middleware";
import { canGrantGroupMembership } from "~/lib/group/positions";
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
            "Update a member's role in a group. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader — a sitting leader may only hand the leadership over to someone else, or, in an interest group, set a leader back to member while another leader remains.",
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
    // leader may do through that ownership is narrowed in the handler.
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
        // requireAccess checks ownership first, so a leader who also holds
        // "groups:manage" must not be narrowed to the leader-only rules.
        const asSittingLeader =
            c.get("isResourceOwner") === true &&
            !(await hasScopedPermission(
                ctx,
                c.get("user").id,
                "groups:manage",
                `group:${groupSlug}`,
            ));

        if (asSittingLeader && body.role === "leader") {
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

        // Lederen gir vervet videre, men setter ikke folk ned — bortsett fra
        // en medleder i interessegrupper, så lenge gruppa beholder en leder.
        if (asSittingLeader && body.role === "member") {
            if (!allowsMultipleLeaders(group.type)) {
                throw new HTTPException(403, {
                    message:
                        "Changing a member's role requires the 'groups:manage' permission",
                });
            }
            const otherLeader = await db.query.groupMembership.findFirst({
                where: {
                    groupSlug,
                    role: "leader",
                    userId: { ne: userId },
                },
            });
            if (!otherLeader) {
                throw new HTTPException(400, {
                    message: "A group cannot be left without a leader",
                });
            }
        }

        if (
            body.role === "leader" &&
            !(await canGrantGroupMembership(
                ctx,
                c.get("user").id,
                group,
                "leader",
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "You can only appoint a leader when you hold the TIHLDE-wide permissions that come with it",
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
            // lederen ned, akkurat som updateGroupMemberRole gjør nedenfor.
            await addUserToGroup(ctx, userId, groupSlug, "leader");

            return c.json({ message: "Member role updated successfully" }, 200);
        }

        // Goes through the helper rather than a bare UPDATE: it sets the
        // sitting leader down (a group has one leader) and keeps De Eldstes
        // Raad in sync.
        await updateGroupMemberRole(ctx, userId, groupSlug, body.role);

        return c.json(
            {
                message: "Member role updated successfully",
            },
            200,
        );
    },
);
