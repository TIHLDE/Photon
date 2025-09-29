// Canonical, hardcoded permission names. These are referenced directly in endpoints/middleware.
export const PERMISSIONS = [
    // Events
    "events:create",
    "events:update",
    "events:delete",
    // Event registrations
    "events:registrations:list",
    "events:registrations:get",
    "events:registrations:create",
    "events:registrations:delete",
    "events:registrations:checkin",
    // Event feedback
    "events:feedback:list",
    "events:feedback:get",
    "events:feedback:update",
    "events:feedback:delete",
    // Event payments
    "events:payments:list",
    "events:payments:get",
    "events:payments:create",
    "events:payments:update",
    "events:payments:delete",
] as const;

export type PermissionName = (typeof PERMISSIONS)[number];

export const PERMISSIONS_SET = new Set<string>(
    PERMISSIONS as readonly string[],
);

export function isPermissionName(name: string): name is PermissionName {
    return PERMISSIONS_SET.has(name);
}

export function getAllPermissionNames(): PermissionName[] {
    return [...PERMISSIONS] as PermissionName[];
}
