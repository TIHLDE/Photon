/**
 * Permission granting and revoking functions.
 *
 * This module provides functions to grant and revoke direct permissions
 * to users (not through roles).
 */

import { and, eq, sql } from "drizzle-orm";
import { userPermission } from "~/db/schema";
import type { AppContext } from "~/lib/ctx";

/**
 * Grant a direct permission to a user.
 * Useful for ad-hoc permissions without creating a role.
 *
 * @param grantedByUserId - User granting the permission (for audit trail)
 * @param targetUserId - User receiving the permission
 * @param permission - Permission name (e.g., "events:create")
 * @param scope - Optional scope (e.g., "group:fotball")
 *
 * @example
 * // Grant global permission
 * await grantUserPermission(ctx, adminId, userId, "events:create");
 *
 * // Grant scoped permission
 * await grantUserPermission(ctx, adminId, userId, "events:update", "group:fotball");
 */
export async function grantUserPermission(
    ctx: AppContext,
    grantedByUserId: string,
    targetUserId: string,
    permission: string,
    scope?: string,
): Promise<void> {
    const db = ctx.db;
    await db
        .insert(userPermission)
        .values({
            userId: targetUserId,
            permission,
            scope: scope ?? null,
            grantedBy: grantedByUserId,
        })
        .onConflictDoNothing();
}

/**
 * Revoke a direct permission from a user.
 *
 * @param targetUserId - User to revoke permission from
 * @param permission - Permission name to revoke
 * @param scope - Optional scope (must match exactly)
 *
 * @example
 * // Revoke global permission
 * await revokeUserPermission(ctx, userId, "events:create");
 *
 * // Revoke scoped permission
 * await revokeUserPermission(ctx, userId, "events:update", "group:fotball");
 */
export async function revokeUserPermission(
    ctx: AppContext,
    targetUserId: string,
    permission: string,
    scope?: string,
): Promise<void> {
    const db = ctx.db;
    await db
        .delete(userPermission)
        .where(
            and(
                eq(userPermission.userId, targetUserId),
                eq(userPermission.permission, permission),
                scope !== undefined
                    ? eq(userPermission.scope, scope)
                    : sql`${userPermission.scope} IS NULL`,
            ),
        );
}
