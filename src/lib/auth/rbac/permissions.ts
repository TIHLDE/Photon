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
 * Nested permission registry.
 *
 * Structure:
 * - Each domain has an `actions` array for direct permissions
 * - Nested sub-domains are objects with their own `actions`
 *
 * This generates permissions like:
 * - "events:view", "events:create" (from events.actions)
 * - "events:registrations:view" (from events.registrations.actions)
 */
export const PERMISSION_REGISTRY = {
    // System permissions
    roles: {
        actions: ["view", "create", "update", "delete", "assign"],
    },
    users: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
    "api-keys": {
        actions: ["view", "create", "update", "delete"],
    },

    // Event permissions
    events: {
        actions: ["view", "create", "update", "delete", "manage"],
        registrations: {
            actions: ["view", "create", "delete", "checkin", "manage"],
        },
        feedback: {
            actions: ["view", "create", "update", "delete"],
        },
        payments: {
            actions: ["view", "create", "update", "delete", "refund"],
        },
    },

    // Group permissions
    groups: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
    fines: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
    forms: {
        actions: ["view", "create", "update", "delete", "manage"],
    },

    // News permissions
    news: {
        actions: ["view", "create", "update", "delete", "manage"],
        reactions: {
            actions: ["create", "delete"],
        },
    },

    // Job permissions
    jobs: {
        actions: ["view", "create", "update", "delete", "manage"],
    },
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

/** Node in the permission tree - has actions and optional nested domains */
type PermissionNode = {
    readonly actions: readonly string[];
    readonly [key: string]: readonly string[] | PermissionNode;
};

/** Recursively extract permissions from nested registry */
type ExtractPermissions<
    T extends PermissionNode,
    Prefix extends string = "",
> = {
    [K in keyof T]: K extends "actions"
        ? T[K] extends readonly string[]
            ? `${Prefix}${T[K][number]}`
            : never
        : T[K] extends PermissionNode
          ? ExtractPermissions<T[K], `${Prefix}${K & string}:`>
          : never;
}[keyof T];

type PermissionFromRegistry = {
    [K in keyof Registry]: Registry[K] extends PermissionNode
        ? ExtractPermissions<Registry[K], `${K & string}:`>
        : never;
}[keyof Registry];

type SpecialPermission = (typeof SPECIAL_PERMISSIONS)[number];

/**
 * Union type of all valid permission names.
 * Examples: "events:create", "events:registrations:view", "root"
 */
export type Permission = PermissionFromRegistry | SpecialPermission;

/**
 * Recursively flattens the nested permission registry into permission strings.
 */
function flattenPermissionRegistry(
    node: PermissionNode,
    prefix: string,
): string[] {
    const names: string[] = [];

    for (const key of Object.keys(node)) {
        const value = node[key];

        if (key === "actions" && Array.isArray(value)) {
            // Add all actions with current prefix
            for (const action of value) {
                names.push(`${prefix}${action}`);
            }
        } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
        ) {
            // Recurse into nested domain
            names.push(
                ...flattenPermissionRegistry(
                    value as PermissionNode,
                    `${prefix}${key}:`,
                ),
            );
        }
    }

    return names;
}

/**
 * Flattens the entire registry from all top-level domains.
 */
function flattenRegistry(registry: Registry): string[] {
    const names: string[] = [];
    for (const domain of Object.keys(registry)) {
        const node = registry[domain as keyof Registry] as PermissionNode;
        names.push(...flattenPermissionRegistry(node, `${domain}:`));
    }
    return names;
}

/**
 * Array of all valid permissions in the system.
 */
export const PERMISSIONS: readonly string[] = Object.freeze([
    ...flattenRegistry(PERMISSION_REGISTRY),
    ...SPECIAL_PERMISSIONS,
]);

/**
 * Set of all valid permission names for O(1) lookup.
 */
export const PERMISSIONS_SET = new Set<string>(PERMISSIONS);

/**
 * Type guard to check if a string is a valid permission.
 */
export function isPermission(name: string): name is Permission {
    return PERMISSIONS_SET.has(name);
}

/**
 * Returns all permissions as an array.
 */
export function getAllPermissions(): string[] {
    return [...PERMISSIONS];
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
    ctx: AppContext,
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
    ctx: AppContext,
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
