/**
 * Permission checking functions.
 *
 * This module provides functions to check if a user has specific permissions,
 * both globally and within specific scopes.
 */

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { role, userPermission, userRole } from "@photon/db/schema";
import type { DbSchema } from "@photon/db";
import {
    GLOBAL_SCOPE,
    formatPermission,
    matchesPermission,
    parsePermission,
} from "../permission-parser";

type DbCtx = { db: NodePgDatabase<DbSchema> };

// =============================================================================
// Get User Permissions
// =============================================================================

/**
 * Get all permissions for a user from their roles.
 * Returns raw array with potential duplicates.
 */
async function getPermissionsFromRoles(
    ctx: DbCtx,
    userId: string,
): Promise<string[]> {
    const db = ctx.db;
    const rows = await db
        .select({ permissions: role.permissions })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    return rows.flatMap((r) => r.permissions ?? []);
}

/**
 * Get all direct permissions for a user (not from roles).
 * Returns array of permission strings in format "permission" or "permission@scope".
 */
async function getDirectPermissions(
    ctx: DbCtx,
    userId: string,
): Promise<string[]> {
    const db = ctx.db;
    const rows = await db
        .select({
            permission: userPermission.permission,
            scope: userPermission.scope,
        })
        .from(userPermission)
        .where(eq(userPermission.userId, userId));

    return rows.map((r) => formatPermission(r.permission, r.scope));
}

/**
 * Get all permissions for a user (from roles + direct grants).
 * Returns raw array with potential duplicates.
 */
export async function getUserPermissions(
    ctx: DbCtx,
    userId: string,
): Promise<string[]> {
    const [rolePerms, directPerms] = await Promise.all([
        getPermissionsFromRoles(ctx, userId),
        getDirectPermissions(ctx, userId),
    ]);

    return [...rolePerms, ...directPerms];
}

/**
 * Get all direct permissions for a user with scope information.
 *
 * @example
 * const perms = await getUserPermissionsWithScope(ctx, userId);
 * // [
 * //   { permission: "events:create", scope: "*" },
 * //   { permission: "events:update", scope: "group:fotball" },
 * // ]
 */
export async function getUserPermissionsWithScope(
    ctx: DbCtx,
    userId: string,
): Promise<Array<{ permission: string; scope: string }>> {
    const db = ctx.db;
    const rows = await db
        .select({
            permission: userPermission.permission,
            scope: userPermission.scope,
        })
        .from(userPermission)
        .where(eq(userPermission.userId, userId));

    return rows;
}

// =============================================================================
// Permission Checking - Global
// =============================================================================

/**
 * Check if user has "root" permission (grants everything).
 */
function hasRoot(permissions: string[]): boolean {
    return permissions.includes("root");
}

/**
 * Check if a user has a permission GLOBALLY (no scope restriction).
 * User can perform this action on ANY resource.
 *
 * Accepts a single permission or array of permissions.
 * For arrays, returns true if user has ANY of them.
 *
 * @example
 * // Single permission
 * if (await hasPermission(ctx, userId, 'events:delete')) {
 *     // User can delete ANY event
 * }
 *
 * // Multiple permissions (ANY)
 * if (await hasPermission(ctx, userId, ['events:update', 'events:manage'])) {
 *     // User can update or manage ANY event
 * }
 */
export async function hasPermission(
    ctx: DbCtx,
    userId: string,
    permissionName: string | string[],
): Promise<boolean> {
    const permissionNames = Array.isArray(permissionName)
        ? permissionName
        : [permissionName];

    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    return permissionNames.some((requiredPerm) =>
        permissions.some((p) => {
            const parsed = parsePermission(p);
            return (
                parsed.permission === requiredPerm &&
                parsed.scope === GLOBAL_SCOPE
            );
        }),
    );
}

// =============================================================================
// Permission Checking - Scoped
// =============================================================================

/**
 * Check if a user has a permission for a specific scope.
 * Checks both global permissions and scoped permissions.
 *
 * Accepts a single permission or array of permissions.
 * For arrays, returns true if user has ANY of them (globally or scoped).
 *
 * Rules:
 * - Global permission (no scope) matches ANY scope request
 * - Scoped permission only matches exact scope
 *
 * @example
 * // Single permission - returns true if user has:
 * // - "events:update" (global)
 * // - "events:update@group:fotball" (scoped, exact match)
 * if (await hasScopedPermission(ctx, userId, "events:update", "group:fotball")) {
 *     // Allow update
 * }
 *
 * // Multiple permissions (ANY)
 * if (await hasScopedPermission(ctx, userId, ["events:update", "events:manage"], "group:fotball")) {
 *     // Allow update or manage
 * }
 */
export async function hasScopedPermission(
    ctx: DbCtx,
    userId: string,
    permissionName: string | string[],
    requiredScope: string,
): Promise<boolean> {
    const permissionNames = Array.isArray(permissionName)
        ? permissionName
        : [permissionName];

    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    return permissionNames.some((requiredPerm) =>
        permissions.some((grantedPerm) =>
            matchesPermission(grantedPerm, requiredPerm, requiredScope),
        ),
    );
}
