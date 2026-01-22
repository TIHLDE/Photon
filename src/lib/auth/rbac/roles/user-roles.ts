/**
 * User-role assignment functions.
 *
 * This module provides functions to manage the relationship between users and roles.
 */

import { and, eq, inArray } from "drizzle-orm";
import { role, userRole } from "~/db/schema";
import type { AppContext } from "~/lib/ctx";
import { getRoleByName } from "./queries";

/**
 * Get all role names assigned to a user.
 */
export async function getUserRoles(
    ctx: AppContext,
    userId: string,
): Promise<string[]> {
    const db = ctx.db;
    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    return rows.map((r) => r.name);
}

/**
 * Check if a user has a specific role.
 */
export async function userHasRole(
    ctx: AppContext,
    userId: string,
    roleName: string,
): Promise<boolean> {
    const db = ctx.db;
    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(and(eq(userRole.userId, userId), eq(role.name, roleName)))
        .limit(1);
    return rows.length > 0;
}

/**
 * Check if a user has any of the specified roles.
 */
export async function userHasAnyRole(
    ctx: AppContext,
    userId: string,
    roleNames: string[],
): Promise<boolean> {
    if (roleNames.length === 0) return false;
    const db = ctx.db;
    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(and(eq(userRole.userId, userId), inArray(role.name, roleNames)))
        .limit(1);
    return rows.length > 0;
}

/**
 * Assign a role to a user.
 * Throws if role doesn't exist.
 * Does nothing if already assigned (upsert behavior).
 */
export async function assignUserRole(
    ctx: AppContext,
    userId: string,
    roleName: string,
): Promise<void> {
    const r = await getRoleByName(ctx, roleName);
    if (!r) throw new Error(`Role not found: ${roleName}`);

    const db = ctx.db;
    await db
        .insert(userRole)
        .values({ userId, roleId: r.id })
        .onConflictDoNothing();
}

/**
 * Remove a role from a user.
 * Does nothing if role doesn't exist or isn't assigned.
 */
export async function removeUserRole(
    ctx: AppContext,
    userId: string,
    roleName: string,
): Promise<void> {
    const r = await getRoleByName(ctx, roleName);
    if (!r) return;

    const db = ctx.db;
    await db
        .delete(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.roleId, r.id)));
}

/**
 * Get all user IDs that have a specific role.
 */
export async function getRoleUserIds(
    ctx: AppContext,
    roleName: string,
): Promise<string[]> {
    const r = await getRoleByName(ctx, roleName);
    if (!r) return [];

    const db = ctx.db;
    const rows = await db
        .select({ userId: userRole.userId })
        .from(userRole)
        .where(eq(userRole.roleId, r.id));

    return rows.map((x) => x.userId);
}
