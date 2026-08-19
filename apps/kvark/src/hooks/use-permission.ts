import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
    authQueryOptions,
    sessionHasPermission,
    sessionHasPermissionInAnyScope,
    sessionHasScopedPermission,
} from "#/api/auth";
import { ALL_ADMIN_SECTION_PERMISSIONS } from "#/lib/admin-sections";

/**
 * Whether the current session holds `required` globally.
 *
 * This gates the UI only — the API enforces the same permissions server-side,
 * so this is purely cosmetic. See {@link sessionHasPermission}: `"root"` grants
 * everything and a scoped grant does NOT satisfy a global check.
 */
export function usePermission(required: string | readonly string[]): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return sessionHasPermission(session?.permissions, required);
}

/**
 * Whether the current session holds `required` globally or within `scope`
 * (e.g. `"group:fotball"`). Use this when the action's scope is known — it is
 * exactly what the API checks. See {@link sessionHasScopedPermission}.
 */
export function useScopedPermission(
    required: string | readonly string[],
    scope: string,
): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return sessionHasScopedPermission(session?.permissions, required, scope);
}

/**
 * Returns a predicate for "holds `required` for this group".
 *
 * For pickers over many groups — the organiser-group select on an event —
 * where calling {@link useScopedPermission} once per group is not an option.
 * A global grant satisfies every group, exactly as the API reads it.
 */
export function useCanActForGroup(
    required: string | readonly string[],
): (groupSlug: string) => boolean {
    const { data: session } = useQuery(authQueryOptions);
    const permissions = session?.permissions;

    return useCallback(
        (groupSlug: string) =>
            sessionHasScopedPermission(
                permissions,
                required,
                `group:${groupSlug}`,
            ),
        [permissions, required],
    );
}

/**
 * Whether the current session holds `required` in any scope at all.
 *
 * For entry points that lead to a mixed listing (the admin sections), where
 * hiding the entry from someone holding the permission for a single group
 * would take away work they are allowed to do. Prefer
 * {@link useScopedPermission} whenever the scope is known.
 */
export function useAnyScopePermission(
    required: string | readonly string[],
): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return sessionHasPermissionInAnyScope(session?.permissions, required);
}

/**
 * Returns a predicate for "may act on this specific resource".
 *
 * News articles, job postings and events all let their creator edit and
 * delete their own item without any permission — `requireAccess({ ownership })`
 * server-side. Gating those buttons on the permission alone would hide them
 * from the very person who wrote the item, so pass the resource's
 * `createdById` and let the predicate account for that.
 */
export function useCanActOnResource(
    required: string | readonly string[],
): (createdById: string | null | undefined) => boolean {
    const { data: session } = useQuery(authQueryOptions);
    const hasPermission = sessionHasPermissionInAnyScope(
        session?.permissions,
        required,
    );
    const userId = session?.user?.id;

    return useCallback(
        (createdById: string | null | undefined) =>
            hasPermission || (Boolean(createdById) && createdById === userId),
        [hasPermission, userId],
    );
}

/**
 * Returns a predicate for "may act on this one resource, which belongs to a
 * group".
 *
 * The scoped counterpart to {@link useCanActOnResource}, and what the API
 * actually asks for an event: `requireEventAccess` checks the permission
 * against the *arranging group*, lets the creator through, and falls back to
 * the global check when the resource has no group (events migrated from
 * Lepton have no organiser). Using the any-scope check here instead offered
 * Sosialen's members the edit form on Index' arrangementer, where saving
 * could only ever answer 403.
 *
 * Pass a module-level constant as `required` — the predicate's identity
 * depends on it.
 */
export function useCanActOnGroupResource(
    required: string | readonly string[],
): (
    groupSlug: string | null | undefined,
    createdById?: string | null,
) => boolean {
    const { data: session } = useQuery(authQueryOptions);
    const permissions = session?.permissions;
    const userId = session?.user?.id;

    return useCallback(
        (groupSlug: string | null | undefined, createdById?: string | null) => {
            if (createdById && createdById === userId) return true;
            return groupSlug
                ? sessionHasScopedPermission(
                      permissions,
                      required,
                      `group:${groupSlug}`,
                  )
                : sessionHasPermission(permissions, required);
        },
        [permissions, userId, required],
    );
}

/**
 * Permissions that grant access to at least one section of the admin panel.
 * Holding any of these (or `"root"`) makes a user an "admin" for the purpose
 * of showing admin entry points that live outside the panel (e.g. the "Admin"
 * links in the command menu and profile nav).
 *
 * Derived from {@link ADMIN_SECTION_PERMISSIONS} so the entry points can never
 * drift from what the sidebar actually shows. Deliberately does NOT include
 * the permissions in the baseline `member` role — every student holds those,
 * and they open no admin section.
 */
export const ADMIN_DASHBOARD_PERMISSIONS = ALL_ADMIN_SECTION_PERMISSIONS;

/**
 * Whether the current user is the leader of `slug`. Several endpoints let a
 * group's leader act without any permission grant (`ownership: isGroupLeader`),
 * so the UI has to know about it too.
 */
export function useIsGroupLeaderOf(slug: string): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return Boolean(
        session?.groups?.some(
            (group) => group.slug === slug && group.role === "leader",
        ),
    );
}

/**
 * The slugs of every group the current user leads.
 *
 * For listings that must be narrowed to what the viewer may act on. Leadership
 * is membership, not a permission string, so it cannot be read out of
 * `session.permissions` the way {@link useCanActForGroup} reads a grant.
 */
export function useLedGroupSlugs(): ReadonlySet<string> {
    const { data: session } = useQuery(authQueryOptions);
    const groups = session?.groups;
    return useMemo(
        () =>
            new Set(
                (groups ?? [])
                    .filter((group) => group.role === "leader")
                    .map((group) => group.slug),
            ),
        [groups],
    );
}

/**
 * Whether the current user is a member of `slug` at all. Bøter and lovverk are
 * readable by a group's members without any grant (`isGroupMember` server-side),
 * so the navigation has to know about membership to avoid offering tabs that
 * only ever answer 403.
 */
export function useIsGroupMemberOf(slug: string): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return Boolean(session?.groups?.some((group) => group.slug === slug));
}

/**
 * Whether the current user leads at least one group. Group leaders may create
 * and assign group-scoped verv without holding any global `roles:*`
 * permission, so they have real work in the admin panel too.
 */
export function useIsGroupLeader(): boolean {
    const { data: session } = useQuery(authQueryOptions);
    return Boolean(session?.groups?.some((group) => group.role === "leader"));
}

/**
 * Whether the current user has anything to do in the admin panel — any
 * permission that opens a section (in any scope), or leadership of a group.
 * Use this to decide whether to show admin entry points outside the panel.
 */
export function useIsAdmin(): boolean {
    const hasSectionPermission = useAnyScopePermission(
        ADMIN_DASHBOARD_PERMISSIONS,
    );
    const isGroupLeader = useIsGroupLeader();
    return hasSectionPermission || isGroupLeader;
}
