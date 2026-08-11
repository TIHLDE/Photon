/**
 * The group leader's permission set.
 *
 * Leadership is a membership role rather than a verv, so it had no editable
 * permissions of its own — the only way to let a leader run their group's
 * events was a global grant, which opened every group's. These permissions are
 * held by whoever leads the group right now, scoped to that group, and are
 * edited from the same verv table as the group's positions.
 *
 * The whole set is stored per group and editable. There used to be a hardcoded
 * baseline every leader held regardless of configuration; it was migrated into
 * each group's `leaderPermissions` and removed, so what the admin UI shows is
 * now the whole truth.
 *
 * Guardrails are the position ones, deliberately: managing this is managing a
 * group-scoped verv, and you still cannot hand out what you do not hold.
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
    leaderPermissionsSchema,
    updateLeaderPermissionsSchema,
} from "./schema";

export const getLeaderPermissionsRoute = route().get(
    "/:groupSlug/leader-permissions",
    describeRoute({
        tags: ["positions"],
        summary: "Get the group leader's permissions",
        operationId: "getGroupLeaderPermissions",
        description:
            "The permissions held by whoever currently leads the group, scoped to that group. Requires the same rights as managing the group's verv.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: leaderPermissionsSchema,
            description: "The leader's permissions",
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
            .select({ permissions: schema.group.leaderPermissions })
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

        return c.json({ permissions: knownPermissions(group.permissions) });
    },
);

export const updateLeaderPermissionsRoute = route().patch(
    "/:groupSlug/leader-permissions",
    describeRoute({
        tags: ["positions"],
        summary: "Set the group leader's permissions",
        operationId: "updateGroupLeaderPermissions",
        description:
            "Replace the permissions held by the group's leader. Granted scoped to this group, so they never reach another group's resources. You can only grant permissions you hold yourself for this group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: leaderPermissionsSchema,
            description: "Updated",
        })
        .badRequest({ description: "Unknown permission" })
        .forbidden({
            description: "Not authorized, or granting permissions you lack",
        })
        .notFound({ description: "Group not found" })
        .build(),
    requireAuth,
    validator("json", updateLeaderPermissionsSchema),
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

        // Same escalation guard as verv: a leader editing their own group
        // cannot grant themselves anything they do not already hold here.
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

        const [updated] = await ctx.db
            .update(schema.group)
            .set({ leaderPermissions: body.permissions })
            .where(eq(schema.group.slug, groupSlug))
            .returning({ permissions: schema.group.leaderPermissions });

        return c.json({ permissions: updated?.permissions ?? [] });
    },
);
