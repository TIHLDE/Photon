/**
 * Role management utilities for Discord-like RBAC system.
 *
 * This module handles all role-related operations including:
 * - User-role assignments
 * - Permission management
 * - Role hierarchy (position-based, Discord-like)
 *
 * Role Hierarchy:
 * - Higher position number = higher in hierarchy (better role)
 * - Users can only manage users/roles with LOWER position numbers (strictly less than)
 * - Users cannot modify their own highest role
 * - Example: admin (position 5) can manage moderator (position 3), but not themselves or position 5+
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { role, userRole } from "~/db/schema";
import type { AppContext } from "~/lib/ctx";
import type { DbTransaction } from "~/db";

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
 * Get a role by its name.
 */
export async function getRoleByName(ctx: AppContext, roleName: string) {
    const db = ctx.db;
    const [r] = await db.select().from(role).where(eq(role.name, roleName));
    return r ?? null;
}

/**
 * Get a role by its ID.
 */
export async function getRoleById(ctx: AppContext, roleId: number) {
    const db = ctx.db;
    const [r] = await db.select().from(role).where(eq(role.id, roleId));
    return r ?? null;
}

/**
 * Get all roles from database, ordered by position (best first).
 * Higher position = better role, so descending order.
 */
export async function getAllRoles(ctx: AppContext) {
    const db = ctx.db;
    return await db.select().from(role).orderBy(sql`${role.position} DESC`);
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

/**
 * Get all permissions for a user (from all their roles).
 * Returns raw array with potential duplicates - should be deduplicated by caller.
 */
export async function getUserPermissions(
    ctx: AppContext,
    userId: string,
): Promise<string[]> {
    const db = ctx.db;
    const rows = await db
        .select({ permissions: role.permissions })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    const all = rows.flatMap((r) => r.permissions ?? []);
    return all;
}

/**
 * Assign (merge) permissions to a role.
 * Adds new permissions without removing existing ones.
 * Throws if role doesn't exist.
 */
export async function assignRolePermissions(
    ctx: AppContext,
    roleName: string,
    permissionNames: string[],
): Promise<void> {
    const r = await getRoleByName(ctx, roleName);
    if (!r) throw new Error(`Role not found: ${roleName}`);

    if (permissionNames.length === 0) return;

    const existing = r.permissions ?? [];
    const merged = [...new Set([...existing, ...permissionNames])];

    const db = ctx.db;
    await db.update(role).set({ permissions: merged }).where(eq(role.id, r.id));
}

/**
 * Set (replace) all permissions for a role.
 * Replaces existing permissions entirely.
 * Throws if role doesn't exist.
 */
export async function setRolePermissions(
    ctx: AppContext,
    roleName: string,
    permissionNames: string[],
): Promise<void> {
    const r = await getRoleByName(ctx, roleName);
    if (!r) throw new Error(`Role not found: ${roleName}`);

    const db = ctx.db;
    await db
        .update(role)
        .set({ permissions: permissionNames })
        .where(eq(role.id, r.id));
}

/**
 * Shift all roles at or above a position up by 1 (increment position numbers).
 * Used when inserting a new role to maintain unique positions.
 * Higher position = better role, so incrementing pushes them down in hierarchy.
 *
 * @param fromPosition - Shift all roles >= this position up by 1
 */
async function shiftRolesUp(
    fromPosition: number,
    tx: DbTransaction,
): Promise<void> {
    // Get all roles at or above this position
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(sql`${role.position} >= ${fromPosition}`)
        .orderBy(sql`${role.position} DESC`); // Start from highest to avoid conflicts

    // Shift each role up by 1 (increment position)
    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position + 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Shift all roles strictly above a deleted position down by 1.
 * This fills the gap left after deleting a role.
 *
 * @param deletedPosition - The position of the role that was deleted
 */
async function shiftRolesDown(
    deletedPosition: number,
    tx: DbTransaction,
): Promise<void> {
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(sql`${role.position} > ${deletedPosition}`)
        .orderBy(role.position); // ascending, lowest first

    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position - 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Shift roles in a range down by 1 (decrement position numbers).
 * Used when moving a role up in hierarchy (to a higher position number).
 * Higher position = better role, so decrementing fills gaps when role moves up.
 *
 * @param fromPosition - Start of range (inclusive)
 * @param toPosition - End of range (exclusive)
 */
async function shiftRolesDownInRange(
    fromPosition: number,
    toPosition: number,
    tx: DbTransaction,
): Promise<void> {
    // Get all roles in range [fromPosition, toPosition)
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(
            and(
                sql`${role.position} >= ${fromPosition + 1}`,
                sql`${role.position} < ${toPosition + 1}`,
            ),
        )
        .orderBy(role.position); // Start from lowest to avoid conflicts

    // Shift each role down by 1 (decrement position)
    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position - 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Shift roles in a range up by 1 (increment position numbers).
 * Used when moving a role down in hierarchy (to a lower position number).
 * Higher position = better role, so incrementing makes room when role moves down.
 *
 * @param toPosition - Start of range (inclusive)
 * @param fromPosition - End of range (exclusive)
 */
async function shiftRolesUpInRange(
    fromPosition: number,
    toPosition: number,
    tx: DbTransaction,
): Promise<void> {
    // Get all roles in range [toPosition, fromPosition)
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(
            and(
                sql`${role.position} >= ${toPosition}`,
                sql`${role.position} < ${fromPosition}`,
            ),
        )
        .orderBy(sql`${role.position} DESC`); // Start from highest to avoid conflicts

    // Shift each role up by 1 (increment position)
    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position + 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Reorder a role to a new position.
 * Validates that the user can manage this reordering based on hierarchy.
 * Automatically shifts other roles to maintain unique positions.
 *
 * Discord-like behavior:
 * - Can only move roles you can manage (position < your position, strictly)
 * - Cannot move your own highest role (prevents self-demotion)
 * - Can only move them to positions < your highest role (strictly)
 * - Shifts other roles automatically to maintain unique positions
 *
 * @param userId - User performing the reorder
 * @param roleId - Role to reorder
 * @param newPosition - Desired new position (must be < user's highest role, strictly)
 *
 * @example
 * // Roles: member(1), moderator(2), event-mgr(3), admin(5)
 * // Admin drags event-mgr from 3 to 2
 * await reorderRole(adminId, eventMgrRoleId, 2);
 * // Result: member(1), event-mgr(2), moderator(3), admin(5)
 * // Note: Roles shift automatically to maintain unique positions
 */
export async function reorderRole(
    ctx: AppContext,
    userId: string,
    roleId: number,
    newPosition: number,
): Promise<void> {
    const [userPosition, targetRole] = await Promise.all([
        getUserHighestRolePosition(ctx, userId),
        getRoleById(ctx, roleId),
    ]);

    if (userPosition === null) {
        throw new Error("User has no roles");
    }

    if (!targetRole) {
        throw new Error("Role not found");
    }

    if (targetRole.position === userPosition) {
        throw new Error("Cannot modify your highest role");
    }

    // User must be able to manage the target role (user position > target position, strictly)
    if (targetRole.position > userPosition) {
        throw new Error("Cannot manage this role - insufficient hierarchy");
    }

    // New position must be below user's position (strictly less than)
    if (newPosition >= userPosition) {
        throw new Error("Cannot move role to or above your position");
    }

    const oldPosition = targetRole.position;

    // If position hasn't changed, nothing to do
    if (oldPosition === newPosition) {
        return;
    }

    const db = ctx.db;
    await db.transaction(async (tx) => {
        if (newPosition > oldPosition) {
            // Moving up in hierarchy (higher position number)
            // Example: Moving from 2 to 4
            // Shift roles at positions [3, 4] down by 1 to fill the gap
            await shiftRolesDownInRange(oldPosition, newPosition, tx);
        } else {
            // Moving down in hierarchy (lower position number)
            // Example: Moving from 4 to 2
            // Shift roles at positions [2, 3] up by 1 to make room
            await shiftRolesUpInRange(oldPosition, newPosition, tx);
        }

        // Finally, move the target role to its new position
        await tx
            .update(role)
            .set({ position: newPosition })
            .where(eq(role.id, roleId));
    });
}

/**
 * Create a new role with automatic positioning.
 * The role is created at the creator's current position, and the creator is pushed down.
 * Automatically shifts other roles up (increment) to maintain unique positions.
 *
 * Discord-like behavior (higher position = better):
 * - New role gets the creator's current position
 * - Creator and all roles >= creator's position get shifted up by 1
 *
 * @param creatorUserId - User creating the role
 * @param roleData - Role information (name, description, permissions)
 * @returns The created role
 *
 * @example
 * // Before: member(1), moderator(2), admin(4)
 * // Admin creates "event-manager"
 * const newRole = await createRole(adminId, {
 *     name: 'event-manager',
 *     description: 'Can manage events',
 *     permissions: ['events:view', 'events:create', 'events:update'],
 * });
 * // After: member(1), moderator(2), event-manager(4), admin(5)
 * // New role gets position 4, admin shifts to 5
 */
export async function createRole(
    ctx: AppContext,
    creatorUserId: string,
    roleData: {
        name: string;
        description?: string;
        permissions?: string[];
    },
): Promise<typeof role.$inferSelect> {
    const creatorPosition = await getUserHighestRolePosition(
        ctx,
        creatorUserId,
    );

    if (creatorPosition === null) {
        throw new Error("User has no roles and cannot create roles");
    }

    // New role goes at creator's current position
    const newPosition = creatorPosition;

    // Use transaction to ensure atomic shift + insert
    const db = ctx.db;
    const result = await db.transaction(async (tx) => {
        // Shift all roles at creator's position and above up by 1 (increment)
        await shiftRolesUp(newPosition, tx);

        // Insert new role at the creator's old position
        const [newRole] = await tx
            .insert(role)
            .values({
                name: roleData.name,
                description: roleData.description,
                position: newPosition,
                permissions: roleData.permissions ?? [],
            })
            .returning();

        return newRole;
    });

    if (!result) {
        throw new Error("Failed to create role");
    }

    return result;
}

/**
 * Delete a role.
 * User must be able to manage the role (have higher position number).
 *
 * @param userId - User deleting the role
 * @param roleId - Role to delete
 */
export async function deleteRole(
    ctx: AppContext,
    userId: string,
    roleId: number,
): Promise<void> {
    const [userPosition, targetRole] = await Promise.all([
        getUserHighestRolePosition(ctx, userId),
        getRoleById(ctx, roleId),
    ]);

    if (userPosition === null) {
        throw new Error("User has no roles");
    }

    if (!targetRole) {
        throw new Error("Role not found");
    }

    // User must be able to manage the target role (user position > target position)
    if (!(userPosition > targetRole.position)) {
        throw new Error("Cannot delete this role - insufficient hierarchy");
    }

    const db = ctx.db;
    await db.transaction(async (tx) => {
        // delete the role
        await tx.delete(role).where(eq(role.id, roleId));

        // shift down everyone above it
        await shiftRolesDown(targetRole.position, tx);
    });
}

/**
 * Get the highest role position (highest number) for a user.
 * Higher position = higher in hierarchy (better role).
 * Returns null if user has no roles.
 *
 * Example:
 * - member (position 1) - lowest
 * - event-manager (position 2)
 * - moderator (position 3)
 * - admin (position 4)
 * - root (position 5) - highest
 */
export async function getUserHighestRolePosition(
    ctx: AppContext,
    userId: string,
): Promise<number | null> {
    const db = ctx.db;
    const rows = await db
        .select({ position: role.position })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    if (rows.length === 0) return null;

    // Higher position number = higher in hierarchy
    return Math.max(...rows.map((r) => r.position));
}

/**
 * Check if a user can manage another user based on hierarchy.
 * A user can manage another user if they have a strictly higher position (higher number).
 *
 * Discord-like behavior:
 * - admin (position 5) CAN manage moderator (position 3) ✓
 * - moderator (position 3) CANNOT manage admin (position 5) ✗
 * - moderator (position 3) CANNOT manage another moderator (position 3) ✗ (siblings)
 */
export async function userCanManageUser(
    ctx: AppContext,
    managerId: string,
    targetUserId: string,
): Promise<boolean> {
    const [managerPosition, targetPosition] = await Promise.all([
        getUserHighestRolePosition(ctx, managerId),
        getUserHighestRolePosition(ctx, targetUserId),
    ]);

    if (managerPosition === null || targetPosition === null) return false;

    // Must be strictly higher (higher number)
    // This prevents siblings (same position) from managing each other
    return managerPosition > targetPosition;
}
