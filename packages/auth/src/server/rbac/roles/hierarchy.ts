/**
 * Role hierarchy functions.
 *
 * This module provides functions for Discord-like role hierarchy:
 * - Higher position number = higher in hierarchy (better role)
 * - Users can only manage users/roles with LOWER position numbers
 */

import type { DbSchema } from "@photon/db";
import { role, userRole } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Get the highest role position (highest number) for a user.
 * Higher position = higher in hierarchy (better role).
 * Returns null if user has no roles.
 */
export async function getUserHighestRolePosition(
    ctx: { db: NodePgDatabase<DbSchema> },
    userId: string,
): Promise<number | null> {
    const db = ctx.db;
    const rows = await db
        .select({ position: role.position })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    if (rows.length === 0) return null;

    return Math.max(...rows.map((r) => r.position));
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
    ctx: { db: NodePgDatabase<DbSchema> },
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
