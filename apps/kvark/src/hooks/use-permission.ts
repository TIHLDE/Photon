import { useQuery } from "@tanstack/react-query";

import { authQueryOptions, sessionHasPermission } from "#/api/auth";

/**
 * Whether the current session holds `required` globally.
 *
 * This gates the UI only — the API enforces the same permissions server-side,
 * so this is purely cosmetic. See {@link sessionHasPermission}: `"root"` grants
 * everything and a scoped grant does NOT satisfy a global check.
 */
export function usePermission(required: string | string[]): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return sessionHasPermission(session?.permissions, required);
}

/**
 * Permissions that grant access to at least one section of the admin
 * dashboard. Holding any of these (or `"root"`) makes a user an "admin" for
 * the purpose of showing admin entry points that live outside the dashboard
 * (e.g. the "Admin" links in the command menu and profile nav).
 *
 * View-only permissions are intentionally excluded — regular members hold
 * those, and they are not admins.
 */
export const ADMIN_DASHBOARD_PERMISSIONS = [
    "roles:create",
    "roles:update",
    "roles:delete",
    "roles:assign",
    "users:create",
    "users:update",
    "users:delete",
    "users:manage",
    "events:create",
    "events:update",
    "events:delete",
    "events:manage",
    "groups:create",
    "groups:update",
    "groups:delete",
    "groups:manage",
    "fines:create",
    "fines:update",
    "fines:delete",
    "fines:manage",
    "forms:create",
    "forms:update",
    "forms:delete",
    "forms:manage",
    "news:create",
    "news:update",
    "news:delete",
    "news:manage",
    "jobs:create",
    "jobs:update",
    "jobs:delete",
    "jobs:manage",
    "banners:create",
    "banners:update",
    "banners:delete",
    "banners:manage",
] as const;

/**
 * Whether the current user is an admin, i.e. holds any management permission
 * across the admin dashboard sections (or `"root"`). Use this to decide
 * whether to show admin entry points outside the dashboard.
 */
export function useIsAdmin(): boolean {
    return usePermission(ADMIN_DASHBOARD_PERMISSIONS as unknown as string[]);
}
