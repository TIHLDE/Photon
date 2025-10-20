import { aP } from "vitest/dist/chunks/reporters.d.BFLkQcL6.js";
import type { AppContext } from "~/lib/ctx";
import { getUserPermissions } from "./roles";

/**
 * Canonical, hardcoded permission registry grouped by scope.
 * Keys are scopes (e.g. "events", "users"), values are action names.
 * Permissions follow the format: "scope:action" (e.g. "events:create")
 */
export const PERMISSION_REGISTRY = {
    // System permissions
    roles: ["view", "create", "update", "delete", "assign"],
    users: ["view", "create", "update", "delete", "manage"],

    // Event permissions
    events: ["view", "create", "update", "delete", "manage"],
    "events:registrations": ["view", "create", "delete", "checkin", "manage"],
    "events:feedback": ["view", "create", "update", "delete"],
    "events:payments": ["view", "create", "update", "delete", "refund"],
} as const;

/**
 * Extra singleton permissions that don't follow the scope:action pattern.
 * Examples: "root" for full system access
 */
export const EXTRA_PERMISSIONS = ["root"] as const;

// Type utilities for type-safe permission handling
type Registry = typeof PERMISSION_REGISTRY;

type Join<K extends string, V extends readonly string[]> = `${K}:${V[number]}`;

type PermissionFromRegistry = {
    [K in keyof Registry]: Join<K & string, Registry[K]>;
}[keyof Registry];

type ExtraPermission = (typeof EXTRA_PERMISSIONS)[number];

/**
 * Union type of all valid permission names in the system.
 * Examples: "events:create", "users:view", "root"
 */
export type Permission = PermissionFromRegistry | ExtraPermission;

/**
 * Flattens the permission registry into an array of permission strings.
 * Converts { events: ["create", "delete"] } into ["events:create", "events:delete"]
 */
function flattenPermissionRegistry(registry: Registry): string[] {
    const names: string[] = [];
    for (const scope of Object.keys(registry)) {
        const actions = registry[scope as keyof Registry] as readonly string[];
        for (const action of actions) {
            names.push(`${scope}:${action}`);
        }
    }
    return names;
}

/**
 * Array of all valid permissions in the system.
 */
export const PERMISSIONS: readonly Permission[] = Object.freeze([
    ...flattenPermissionRegistry(PERMISSION_REGISTRY),
    ...EXTRA_PERMISSIONS,
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
 * Returns all permissions for a specific scope.
 * Example: getPermissionsForScope("events") returns ["events:view", "events:create", ...]
 */
export function getPermissionsForScope(scope: keyof Registry): string[] {
    const actions = PERMISSION_REGISTRY[scope];
    return actions.map((action) => `${String(scope)}:${action}`);
}

/**
 * Check if a user has a specific permission.
 * Automatically checks for "root" permission which grants everything.
 *
 * @example
 * if (await hasPermission(userId, 'events:delete')) {
 *     // User can delete events
 * }
 */
export async function hasPermission(
    ctx: AppContext,
    userId: string,
    permissionName: string,
): Promise<boolean> {
    const permissions = await getUserPermissions(ctx, userId);
    const valid = permissions.filter((p) => PERMISSIONS_SET.has(p));
    const permSet = new Set(valid);

    // Root permission grants everything
    if (permSet.has("root")) return true;

    return permSet.has(permissionName);
}

/**
 * Check if a user has any of the specified permissions.
 * Automatically checks for "root" permission which grants everything.
 *
 * @example
 * if (await hasAnyPermission(userId, ['events:update', 'events:manage'])) {
 *     // User can update or manage events
 * }
 */
export async function hasAnyPermission(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);
    const valid = permissions.filter((p) => PERMISSIONS_SET.has(p));
    const permSet = new Set(valid);

    // Root permission grants everything
    if (permSet.has("root")) return true;

    return permissionNames.some((p) => permSet.has(p));
}

/**
 * Check if a user has all of the specified permissions.
 * Automatically checks for "root" permission which grants everything.
 *
 * @example
 * if (await hasAllPermissions(userId, ['events:create', 'events:update'])) {
 *     // User can both create and update events
 * }
 */
export async function hasAllPermissions(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);
    const valid = permissions.filter((p) => PERMISSIONS_SET.has(p));
    const permSet = new Set(valid);

    // Root permission grants everything
    if (permSet.has("root")) return true;

    return permissionNames.every((p) => permSet.has(p));
}
