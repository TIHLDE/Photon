import type { AppContext } from "~/lib/ctx";
import { parsePermission } from "./permission-parser";
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
 * Check if a user has a specific permission GLOBALLY (no scope restriction).
 * Automatically checks for "root" permission which grants everything.
 *
 * This checks if the user has the permission without any scope restriction,
 * meaning they can use it for ANY resource.
 *
 * @example
 * if (await hasPermission(ctx, userId, 'events:delete')) {
 *     // User can delete ANY event (global permission)
 * }
 */
export async function hasPermission(
    ctx: AppContext,
    userId: string,
    permissionName: string,
): Promise<boolean> {
    const permissions = await getUserPermissions(ctx, userId);

    // Root permission grants everything
    if (permissions.includes("root")) return true;

    // Check if user has the permission globally (without scope)
    // This means the permission string is exactly the permission name (no "@scope")
    return permissions.some((p) => {
        const parsed = parsePermission(p);
        return parsed.permission === permissionName && parsed.scope === null;
    });
}

/**
 * Check if a user has any of the specified permissions GLOBALLY.
 * Automatically checks for "root" permission which grants everything.
 *
 * @example
 * if (await hasAnyPermission(ctx, userId, ['events:update', 'events:manage'])) {
 *     // User can update or manage ANY event (global permissions)
 * }
 */
export async function hasAnyPermission(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    // Root permission grants everything
    if (permissions.includes("root")) return true;

    // Check if user has any of the permissions globally
    return permissionNames.some((requiredPerm) =>
        permissions.some((p) => {
            const parsed = parsePermission(p);
            return parsed.permission === requiredPerm && parsed.scope === null;
        }),
    );
}

/**
 * Check if a user has all of the specified permissions GLOBALLY.
 * Automatically checks for "root" permission which grants everything.
 *
 * @example
 * if (await hasAllPermissions(ctx, userId, ['events:create', 'events:update'])) {
 *     // User can both create and update ANY event (global permissions)
 * }
 */
export async function hasAllPermissions(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;

    const permissions = await getUserPermissions(ctx, userId);

    // Root permission grants everything
    if (permissions.includes("root")) return true;

    // Check if user has all of the permissions globally
    return permissionNames.every((requiredPerm) =>
        permissions.some((p) => {
            const parsed = parsePermission(p);
            return parsed.permission === requiredPerm && parsed.scope === null;
        }),
    );
}
