/**
 * The group's member permission sets — what EVERY member of the group holds.
 *
 * Two lists, because they are two genuinely different grants and conflating
 * them behind one checkbox would hide which one was handed out:
 *
 * - `permissions` is scoped to the group ("permission@group:<slug>"). This is
 *   the everyday case: everyone in Sosialen may arrange Sosialen's events, and
 *   nobody in NoK can touch them.
 * - `globalPermissions` is unscoped and reaches all of TIHLDE. This is what
 *   lets every Index member administer the whole site; it replaced the
 *   auto-assigned `admin` and `hs` RBAC roles, which did the same thing but
 *   were only editable in the database.
 *
 * Both are read live from the membership (see getPermissionsFromGroups), so
 * joining the group grants them and leaving revokes them with nothing to sync.
 *
 * Guardrails are the verv ones, unchanged and applied per scope: you may only
 * grant what you hold yourself, at the scope you grant it at. A group leader
 * holds nothing globally and therefore cannot write to `globalPermissions` at
 * all — which is the whole reason the global section is safe to expose here.
 */

import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    canGrantPositionPermissions,
    canManagePositions,
    knownPermissions,
} from "~/lib/group/positions";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import {
    memberPermissionsSchema,
    updateMemberPermissionsSchema,
} from "./schema";

export const getMemberPermissionsRoute = route().get(
    "/:groupSlug/member-permissions",
    describeRoute({
        tags: ["positions"],
        summary: "Get the permissions held by every member of the group",
        operationId: "getGroupMemberPermissions",
        description:
            "`permissions` is held by every member scoped to this group; `globalPermissions` is held by every member across all of TIHLDE. Requires the same rights as managing the group's verv.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: memberPermissionsSchema,
            description: "The group's member permissions",
        })
        .forbidden({ description: "Not authorized to manage this group" })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");

        const [group] = await ctx.db
            .select({
                permissions: schema.group.memberPermissions,
                globalPermissions: schema.group.memberGlobalPermissions,
            })
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        if (!(await canManagePositions(ctx, user.id, groupSlug, "group"))) {
            throw new HTTPException(403, {
                message: "Not authorized to manage this group's permissions",
            });
        }

        return c.json({
            permissions: knownPermissions(group.permissions),
            globalPermissions: knownPermissions(group.globalPermissions),
        });
    },
);

export const updateMemberPermissionsRoute = route().patch(
    "/:groupSlug/member-permissions",
    describeRoute({
        tags: ["positions"],
        summary: "Set the permissions held by every member of the group",
        operationId: "updateGroupMemberPermissions",
        description:
            "Replace both lists. `permissions` is granted scoped to this group; `globalPermissions` is granted across all of TIHLDE and therefore requires holding each of them globally yourself.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: memberPermissionsSchema,
            description: "Updated",
        })
        .badRequest({ description: "Unknown permission" })
        .forbidden({
            description: "Not authorized, or granting permissions you lack",
        })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    validator("json", updateMemberPermissionsSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const user = c.get("user");
        const groupSlug = c.req.param("groupSlug");
        const body = c.req.valid("json");

        const [group] = await ctx.db
            .select({ slug: schema.group.slug })
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        if (!(await canManagePositions(ctx, user.id, groupSlug, "group"))) {
            throw new HTTPException(403, {
                message: "Not authorized to manage this group's permissions",
            });
        }

        // Checked per scope, and the global list is the strict one: holding
        // "events:create@group:sosialen" lets you give it to Sosialen's
        // members, but not to all of TIHLDE.
        if (
            !(await canGrantPositionPermissions(
                ctx,
                user.id,
                groupSlug,
                body.permissions,
                "group",
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "You can only grant permissions you hold yourself for this group",
            });
        }

        if (
            !(await canGrantPositionPermissions(
                ctx,
                user.id,
                groupSlug,
                body.globalPermissions,
                "global",
            ))
        ) {
            throw new HTTPException(403, {
                message:
                    "You can only grant TIHLDE-wide permissions you hold globally yourself",
            });
        }

        const [updated] = await ctx.db
            .update(schema.group)
            .set({
                memberPermissions: body.permissions,
                memberGlobalPermissions: body.globalPermissions,
            })
            .where(eq(schema.group.slug, groupSlug))
            .returning({
                permissions: schema.group.memberPermissions,
                globalPermissions: schema.group.memberGlobalPermissions,
            });

        return c.json({
            permissions: updated?.permissions ?? [],
            globalPermissions: updated?.globalPermissions ?? [],
        });
    },
);
