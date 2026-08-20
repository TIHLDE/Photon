/**
 * Group position (verv/tittel) helpers and guardrails.
 *
 * Positions carry permissions that holders receive — scoped to the group or
 * globally. The core guardrail is Discord-style: you can only create, edit or
 * assign a position whose permissions you yourself hold at the position's
 * scope. This prevents privilege escalation via self-defined titles.
 */

import {
    PERMISSIONS_SET,
    hasPermission,
    hasScopedPermission,
} from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { isGroupLeader } from "./index";

/**
 * Drop permission strings the registry no longer knows about.
 *
 * Stored lists outlive the registry: a permission that was renamed or removed
 * stays in whatever column or role array happened to hold it, and the ones
 * migrated off the old `hs` role carry a few such strings. They grant nothing
 * — no route asks for them — but echoing them back to the admin UI means the
 * next save is rejected wholesale as "Unknown permission", leaving the group
 * uneditable. Filtering on read drops them on the next save instead, while the
 * write schema still refuses anything unknown the client makes up.
 */
export function knownPermissions(permissions: string[] | null): string[] {
    return (permissions ?? []).filter((p) =>
        (PERMISSIONS_SET as ReadonlySet<string>).has(p),
    );
}

/**
 * Get a position by id, or null.
 */
export async function getPosition(ctx: AppContext, positionId: string) {
    const [position] = await ctx.db
        .select()
        .from(schema.groupPosition)
        .where(eq(schema.groupPosition.id, positionId))
        .limit(1);
    return position ?? null;
}

/**
 * Can the user manage (create/update/delete) positions in a group at all?
 *
 * - Global-scope positions: requires global "roles:create" (or root).
 * - Group-scope positions: requires being the group's leader, or
 *   "groups:manage" (globally or scoped to the group).
 */
export async function canManagePositions(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
    scope: "group" | "global",
): Promise<boolean> {
    if (scope === "global") {
        return await hasPermission(ctx, userId, ["root", "roles:create"]);
    }

    if (
        await hasScopedPermission(
            ctx,
            userId,
            ["root", "groups:manage", "roles:create"],
            `group:${groupSlug}`,
        )
    ) {
        return true;
    }

    return await isGroupLeader(ctx, userId, groupSlug);
}

/**
 * Can the user edit the group leader's own permission set?
 *
 * Stricter than {@link canManagePositions} on purpose: being the leader is not
 * enough. A leader manages their group — its verv and what every member holds
 * — but their own access is not theirs to change, and is only moved by someone
 * holding "Tilganger" ("roles:create"/"groups:manage", for this group or
 * org-wide).
 *
 * The reason is a trap that cost a leader their access mid-opptak. The leader
 * row and the member list are separate grants, but a leader whose row is empty
 * holds everything through membership — so trimming what the group gives every
 * member silently trimmed the leader too. Worse, it was a one-way door: the
 * escalation guard ("you may only grant what you hold") then refused to let
 * them put it back. Taking the row out of the leader's hands makes the two
 * lists independent in practice and not just in the schema.
 *
 * Reading stays open to anyone who may manage the group's verv — a leader
 * should be able to see what they hold, they just cannot edit it.
 */
export async function canManageLeaderPermissions(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<boolean> {
    return await hasScopedPermission(
        ctx,
        userId,
        ["root", "groups:manage", "roles:create"],
        `group:${groupSlug}`,
    );
}

/**
 * Guardrail: does the user hold every permission in the list at the
 * position's effective scope?
 *
 * - scope "group": each permission must be held globally OR scoped to the
 *   group ("perm@group:<slug>").
 * - scope "global": each permission must be held globally. This also covers
 *   the root-title case — only a root holder can put "root" in a position.
 */
export async function canGrantPositionPermissions(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
    permissions: string[],
    scope: "group" | "global",
): Promise<boolean> {
    for (const permission of permissions) {
        const held =
            scope === "global"
                ? await hasPermission(ctx, userId, permission)
                : await hasScopedPermission(
                      ctx,
                      userId,
                      permission,
                      `group:${groupSlug}`,
                  );
        if (!held) return false;
    }
    return true;
}

/**
 * Can the user assign/unassign holders of a position?
 *
 * Requires the position-management right for the position's scope (see
 * canManagePositions) AND holding all the position's permissions — assigning
 * a title you could not have created is the same escalation.
 */
export async function canAssignPosition(
    ctx: AppContext,
    userId: string,
    position: {
        groupSlug: string;
        permissions: string[];
        scope: "group" | "global";
    },
): Promise<boolean> {
    if (
        !(await canManagePositions(
            ctx,
            userId,
            position.groupSlug,
            position.scope,
        ))
    ) {
        return false;
    }

    return await canGrantPositionPermissions(
        ctx,
        userId,
        position.groupSlug,
        position.permissions,
        position.scope,
    );
}
