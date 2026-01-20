/**
 * Permission management for Discord-like RBAC system.
 *
 * This module handles all permission-related operations:
 * - Permission registry and type definitions
 * - Checking user permissions (global and scoped)
 * - Granting/revoking direct user permissions
 *
 * Permission format:
 * - Global: "events:create" (user can do this for ALL resources)
 * - Scoped: "events:create@group:fotball" (user can only do this for specific scope)
 */

import { and, eq, sql } from "drizzle-orm";
import { role, userPermission, userRole } from "~/db/schema";
import type { AppContext } from "~/lib/ctx";
import {
    formatPermission,
    matchesPermission,
    parsePermission,
} from "./permission-parser";

// =============================================================================
// Permission Registry
// =============================================================================

/**
 * Canonical permission registry grouped by domain.
 * Keys are domains, values are action names.
 * Permissions follow the format: "domain:action" (e.g. "events:create")
 */
export const PERMISSION_REGISTRY = {
    // System permissions
    roles: ["view", "create", "update", "delete", "assign"],
    users: ["view", "create", "update", "delete", "manage"],
    "api-keys": ["view", "create", "update", "delete"],

    // Event permissions
    events: ["view", "create", "update", "delete", "manage"],
    "events:registrations": ["view", "create", "delete", "checkin", "manage"],
    "events:feedback": ["view", "create", "update", "delete"],
    "events:payments": ["view", "create", "update", "delete", "refund"],
    groups: ["view", "create", "update", "delete", "manage"],
    fines: ["view", "create", "update", "delete", "manage"],
    forms: ["view", "create", "update", "delete", "manage"],

    // News permissions
    news: ["view", "create", "update", "delete", "manage"],
    "news:reactions": ["create", "delete"],

    // Job permissions
    jobs: ["view", "create", "update", "delete", "manage"],
} as const;

/**
 * Special permissions that don't follow the domain:action pattern.
 * "root" grants access to everything.
 */
export const SPECIAL_PERMISSIONS = ["root"] as const;

// =============================================================================
// Type Utilities
// =============================================================================

type Registry = typeof PERMISSION_REGISTRY;
type Join<K extends string, V extends readonly string[]> = `${K}:${V[number]}`;
type PermissionFromRegistry = {
    [K in keyof Registry]: Join<K & string, Registry[K]>;
}[keyof Registry];
type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

/**
 * Union type of all valid permission names.
 * Examples: "events:create", "users:view", "root"
 */
export type Permission = PermissionFromRegistry | SpecialPermission;

/**
 * Flattens the permission registry into an array of permission strings.
 */
function flattenPermissionRegistry(registry: Registry): string[] {
    const names: string[] = [];
    for (const domain of Object.keys(registry)) {
        const actions = registry[domain as keyof Registry] as readonly string[];
        for (const action of actions) {
            names.push(`${domain}:${action}`);
        }
    }
    return names;
}

/**
 * Array of all valid permissions in the system.
 */
export const PERMISSIONS: readonly Permission[] = Object.freeze([
    ...flattenPermissionRegistry(PERMISSION_REGISTRY),
    ...SPECIAL_PERMISSIONS,
] as Permission[]);

/**
 * Set of all valid permission names for O(1) lookup.
 */
export const PERMISSIONS_SET = new Set<string>(
    PERMISSIONS as readonly string[],
);

/**
 * Type guard to check if a string is a valid permission.
 */
export function isPermission(name: string): name is Permission {
    return PERMISSIONS_SET.has(name);
}

/**
 * Returns all permissions as an array.
 */
export function getAllPermissions(): Permission[] {
    return [...PERMISSIONS] as Permission[];
}

/**
 * Returns all permissions for a specific domain.
 * Example: getPermissionsForDomain("events") returns ["events:view", "events:create", ...]
 */
export function getPermissionsForDomain(domain: keyof Registry): string[] {
    const actions = PERMISSION_REGISTRY[domain];
    return actions.map((action) => `${String(domain)}:${action}`);
}

// =============================================================================
// Get User Permissions
// =============================================================================

/**
 * Get all permissions for a user from their roles.
 * Returns raw array with potential duplicates.
 */
async function getPermissionsFromRoles(
    ctx: AppContext,
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
    ctx: AppContext,
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
    ctx: AppContext,
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
 * //   { permission: "events:create", scope: null },
 * //   { permission: "events:update", scope: "group:fotball" },
 * // ]
 */
export async function getUserPermissionsWithScope(
    ctx: AppContext,
    userId: string,
): Promise<Array<{ permission: string; scope: string | null }>> {
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
 * Check if a user has a specific permission GLOBALLY (no scope restriction).
 * User can perform this action on ANY resource.
 *
 * @example
 * if (await hasPermission(ctx, userId, 'events:delete')) {
 *     // User can delete ANY event
 * }
 */
export async function hasPermission(
    ctx: AppContext,
    userId: string,
    permissionName: string,
): Promise<boolean> {
    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    // Check if user has the permission globally (without scope)
    return permissions.some((p) => {
        const parsed = parsePermission(p);
        return parsed.permission === permissionName && parsed.scope === null;
    });
}

/**
 * Check if a user has ANY of the specified permissions GLOBALLY.
 *
 * @example
 * if (await hasAnyPermission(ctx, userId, ['events:update', 'events:manage'])) {
 *     // User can update or manage ANY event
 * }
 */
export async function hasAnyPermission(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    return permissionNames.some((requiredPerm) =>
        permissions.some((p) => {
            const parsed = parsePermission(p);
            return parsed.permission === requiredPerm && parsed.scope === null;
        }),
    );
}

/**
 * Check if a user has ALL of the specified permissions GLOBALLY.
 *
 * @example
 * if (await hasAllPermissions(ctx, userId, ['events:create', 'events:update'])) {
 *     // User can both create and update ANY event
 * }
 */
export async function hasAllPermissions(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    return permissionNames.every((requiredPerm) =>
        permissions.some((p) => {
            const parsed = parsePermission(p);
            return parsed.permission === requiredPerm && parsed.scope === null;
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
 * Rules:
 * - Global permission (no scope) matches ANY scope request
 * - Scoped permission only matches exact scope
 *
 * @example
 * // Returns true if user has:
 * // - "events:update" (global)
 * // - "events:update@group:fotball" (scoped, exact match)
 * if (await hasScopedPermission(ctx, userId, "events:update", "group:fotball")) {
 *     // Allow update
 * }
 */
export async function hasScopedPermission(
    ctx: AppContext,
    userId: string,
    permissionName: string,
    requiredScope: string,
): Promise<boolean> {
    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    return permissions.some((grantedPerm) =>
        matchesPermission(grantedPerm, permissionName, requiredScope),
    );
}

/**
 * Check if a user has ANY of the specified permissions for a specific scope.
 * More efficient than calling hasScopedPermission multiple times.
 *
 * @example
 * if (await hasAnyScopedPermission(ctx, userId, ["events:update", "events:manage"], "group:fotball")) {
 *     // Allow update
 * }
 */
export async function hasAnyScopedPermission(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
    requiredScope: string,
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    if (hasRoot(permissions)) return true;

    return permissionNames.some((requiredPerm) =>
        permissions.some((grantedPerm) =>
            matchesPermission(grantedPerm, requiredPerm, requiredScope),
        ),
    );
}

// =============================================================================
// Grant/Revoke Direct Permissions
// =============================================================================

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
