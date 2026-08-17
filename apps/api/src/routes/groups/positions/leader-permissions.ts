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
 * verv, and you still cannot hand out what you do not hold — the group list is
 * checked for this group, the org-wide one globally, so a group leader (who
 * holds nothing globally) can never write the second.
 *
 * The group's name for the role travels with the permissions here: a group
 * that calls its leader "President" should not have to keep a second, manually
 * assigned verv by that name pointing at the same person.
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
            .select({
                permissions: schema.group.leaderPermissions,
                globalPermissions: schema.group.leaderGlobalPermissions,
                title: schema.group.leaderTitle,
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
            title: group.title,
        });
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

        // The org-wide list is checked globally, so holding a permission for
        // this group is not enough to hand it out for every other one. A group
        // leader holds nothing globally and is stopped here.
        if (
            body.globalPermissions !== undefined &&
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
                    "You can only grant permissions you hold yourself across all of TIHLDE",
            });
        }

        const [updated] = await ctx.db
            .update(schema.group)
            .set({
                leaderPermissions: body.permissions,
                // Both optional fields mean "leave alone" when omitted, so a
                // client that knows nothing about them cannot wipe them. For
                // the title, only an explicit null clears it back to «Leder».
                ...(body.globalPermissions === undefined
                    ? {}
                    : { leaderGlobalPermissions: body.globalPermissions }),
                ...(body.title === undefined
                    ? {}
                    : { leaderTitle: body.title?.trim() || null }),
            })
            .where(eq(schema.group.slug, groupSlug))
            .returning({
                permissions: schema.group.leaderPermissions,
                globalPermissions: schema.group.leaderGlobalPermissions,
                title: schema.group.leaderTitle,
            });

        return c.json({
            permissions: updated?.permissions ?? [],
            globalPermissions: updated?.globalPermissions ?? [],
            title: updated?.title ?? null,
        });
    },
);
