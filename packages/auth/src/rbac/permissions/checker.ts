/**
 * Permission checking functions.
 *
 * This module provides functions to check if a user has specific permissions,
 * both globally and within specific scopes.
 */

import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { unionAll } from "drizzle-orm/pg-core";
import {
    group,
    groupMembership,
    groupPosition,
    groupPositionHolder,
    role,
    userPermission,
    userRole,
} from "@photon/db/schema";
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
 * Every way a user can hold a permission, as one query.
 *
 * The six branches were four separate round-trips until we measured what
 * `get-session` actually costs: seven queries per call, each holding its own
 * pool connection, four of them from here. The work itself is sub-millisecond
 * and every branch is index-covered — it was the round-trips that added up, so
 * they are now one.
 *
 * Each branch yields `(permissions, scope)` and nothing else, so the caller
 * formats them all the same way. `scope` is {@link GLOBAL_SCOPE} for the
 * unscoped sources, which {@link formatPermission} passes through untouched —
 * a role permission that already carries its own `@scope` therefore survives
 * verbatim, exactly as when this returned the raw column.
 *
 * The scope literal is cast explicitly: as a bare parameter Postgres cannot
 * infer its type inside a UNION and refuses the query.
 */
function permissionRows(ctx: DbCtx, userId: string) {
    const db = ctx.db;
    const globalScope = sql<string>`cast(${GLOBAL_SCOPE} as text)`;

    /** Roles: the permission strings are stored ready-formatted. */
    const fromRoles = db
        .select({
            permissions: role.permissions,
            scope: globalScope.as("scope"),
        })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    /** Direct grants: one permission per row, with its own scope. */
    const fromDirect = db
        .select({
            permissions: sql<
                string[]
            >`array[${userPermission.permission}]::text[]`.as("permissions"),
            scope: userPermission.scope,
        })
        .from(userPermission)
        .where(eq(userPermission.userId, userId));

    /**
     * Verv (titler): positions with scope "group" grant their permissions
     * scoped to the position's group; positions with scope "global" grant
     * them globally.
     */
    const fromPositions = db
        .select({
            permissions: groupPosition.permissions,
            scope: sql<string>`case
                when ${groupPosition.scope} = 'global' then cast(${GLOBAL_SCOPE} as text)
                else 'group:' || ${groupPosition.groupSlug}
            end`.as("scope"),
        })
        .from(groupPositionHolder)
        .innerJoin(
            groupPosition,
            eq(groupPositionHolder.positionId, groupPosition.id),
        )
        .where(eq(groupPositionHolder.userId, userId));

    /**
     * Held by every member, scoped to the group, so nothing reaches another
     * group's resources.
     */
    const fromMembership = db
        .select({
            permissions: group.memberPermissions,
            scope: sql<string>`'group:' || ${group.slug}`.as("scope"),
        })
        .from(groupMembership)
        .innerJoin(group, eq(groupMembership.groupSlug, group.slug))
        .where(eq(groupMembership.userId, userId));

    /**
     * Held by the leader only, scoped to the group. The leader is a member
     * too, so these stack on top of the member lists.
     */
    const fromLeadership = db
        .select({
            permissions: group.leaderPermissions,
            scope: sql<string>`'group:' || ${group.slug}`.as("scope"),
        })
        .from(groupMembership)
        .innerJoin(group, eq(groupMembership.groupSlug, group.slug))
        .where(
            and(
                eq(groupMembership.userId, userId),
                eq(groupMembership.role, "leader"),
            ),
        );

    /**
     * Held by every member, org-wide. This is what lets all of Index
     * administer TIHLDE; it replaced the auto-assigned `admin` and `hs` RBAC
     * roles, which did the same thing invisibly.
     */
    const fromMembershipGlobal = db
        .select({
            permissions: group.memberGlobalPermissions,
            scope: globalScope.as("scope"),
        })
        .from(groupMembership)
        .innerJoin(group, eq(groupMembership.groupSlug, group.slug))
        .where(eq(groupMembership.userId, userId));

    return unionAll(
        fromRoles,
        fromDirect,
        fromPositions,
        fromMembership,
        fromLeadership,
        fromMembershipGlobal,
    );
}

/**
 * Get all permissions for a user (roles + direct grants + verv + groups).
 * Returns raw array with potential duplicates.
 *
 * Everything a group grants is read live from the membership, so a grant
 * cannot outlive the job: leave the group, or step down as leader, and it is
 * gone on the next check.
 */
export async function getUserPermissions(
    ctx: DbCtx,
    userId: string,
): Promise<string[]> {
    const rows = await permissionRows(ctx, userId);

    return rows.flatMap((row) =>
        (row.permissions ?? []).map((p) => formatPermission(p, row.scope)),
    );
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
/**
 * Check if a user holds a permission globally or for ANY single group.
 *
 * For actions on resources that belong to no group, so there is no scope to
 * check the grant against: a job posting belongs to TIHLDE, not to NOK, yet
 * "NOK publishes the job postings" is exactly what a verv in NOK with
 * `jobs:create` is meant to say. Requiring the grant to be global there would
 * make every group verv on such a resource silently do nothing.
 *
 * Only `*` and `group:<slug>` grants count. A grant scoped to one specific
 * resource (`news:update@news-<id>`, handed out to let someone edit that one
 * article) stays limited to it — checking that is
 * {@link hasScopedPermission}'s job, and this must not widen it.
 */
export async function hasPermissionInAnyGroupScope(
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
        permissions.some((granted) => {
            const parsed = parsePermission(granted);
            return (
                parsed.permission === requiredPerm &&
                (parsed.scope === GLOBAL_SCOPE ||
                    parsed.scope.startsWith("group:"))
            );
        }),
    );
}

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
