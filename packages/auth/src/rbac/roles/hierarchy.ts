/**
 * Role hierarchy functions.
 *
 * This module provides functions for Discord-like role hierarchy:
 * - Higher position number = higher in hierarchy (better role)
 * - Users can only manage users/roles with LOWER position numbers
 */

import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { role, userRole } from "@photon/db/schema";
import type { DbSchema } from "@photon/db";
import { getUserPermissions } from "../permissions/checker";

type DbCtx = { db: NodePgDatabase<DbSchema> };

/**
 * Get the highest role position (highest number) for a user.
 * Higher position = higher in hierarchy (better role).
 * Returns null if user has no roles.
 *
 * A user holding the "root" permission from ANY source (a role, a direct
 * grant, or a global group position/title) outranks every role in the
 * hierarchy: their effective position is one above the current top role.
 * Without this, a root-via-title holder (e.g. Teknologiminister) would have
 * no position at all and fail every hierarchy check.
 */
export async function getUserHighestRolePosition(
    ctx: DbCtx,
    userId: string,
): Promise<number | null> {
    const db = ctx.db;
    const rows = await db
        .select({ position: role.position })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    const ownPosition =
        rows.length === 0 ? null : Math.max(...rows.map((r) => r.position));

    const permissions = await getUserPermissions(ctx, userId);
    if (permissions.includes("root")) {
        const [topRole] = await db
            .select({ position: role.position })
            .from(role)
            .orderBy(desc(role.position))
            .limit(1);
        return Math.max(ownPosition ?? 0, (topRole?.position ?? 0) + 1);
    }

    return ownPosition;
}

/**
 * Check if a user can manage another user based on hierarchy.
 * A user can manage another user if they have a strictly higher position.
 *
 * Discord-like behavior:
 * - admin (position 5) CAN manage moderator (position 3) ✓
 * - moderator (position 3) CANNOT manage admin (position 5) ✗
 * - moderator (position 3) CANNOT manage another moderator (position 3) ✗
 */
export async function userCanManageUser(
    ctx: DbCtx,
    managerId: string,
    targetUserId: string,
): Promise<boolean> {
    const [managerPosition, targetPosition] = await Promise.all([
        getUserHighestRolePosition(ctx, managerId),
        getUserHighestRolePosition(ctx, targetUserId),
    ]);

    if (managerPosition === null || targetPosition === null) return false;

    return managerPosition > targetPosition;
}
