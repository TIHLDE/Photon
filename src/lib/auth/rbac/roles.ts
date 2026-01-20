/**
 * Role management for Discord-like RBAC system.
 *
 * This module handles all role-related operations:
 * - Role CRUD (create, read, update, delete)
 * - User-role assignments
 * - Role hierarchy (position-based, Discord-like)
 * - Role permission management
 *
 * Role Hierarchy:
 * - Higher position number = higher in hierarchy (better role)
 * - Users can only manage users/roles with LOWER position numbers (strictly less than)
 * - Users cannot modify their own highest role
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "~/db";
import { role, userRole } from "~/db/schema";
import type { AppContext } from "~/lib/ctx";

// =============================================================================
// Role Queries
// =============================================================================

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

// =============================================================================
// User-Role Operations
// =============================================================================

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

// =============================================================================
// Role Permission Management
// =============================================================================

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

// =============================================================================
// Role Hierarchy
// =============================================================================

/**
 * Get the highest role position (highest number) for a user.
 * Higher position = higher in hierarchy (better role).
 * Returns null if user has no roles.
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

    return Math.max(...rows.map((r) => r.position));
}

/**
 * Check if a user can manage another user based on hierarchy.
 * A user can manage another user if they have a strictly higher position.
 *
 * Discord-like behavior:
 * - admin (position 5) CAN manage moderator (position 3) ✓
 * - moderator (position 3) CANNOT manage admin (position 5) ✗
 * - moderator (position 3) CANNOT manage another moderator (position 3) ✗
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

    return managerPosition > targetPosition;
}

// =============================================================================
// Role Position Shifting (Internal)
// =============================================================================

/**
 * Shift all roles at or above a position up by 1.
 * Used when inserting a new role.
 */
async function shiftRolesUp(
    fromPosition: number,
    tx: DbTransaction,
): Promise<void> {
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(sql`${role.position} >= ${fromPosition}`)
        .orderBy(sql`${role.position} DESC`);

    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position + 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Shift all roles strictly above a deleted position down by 1.
 */
async function shiftRolesDown(
    deletedPosition: number,
    tx: DbTransaction,
): Promise<void> {
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(sql`${role.position} > ${deletedPosition}`)
        .orderBy(role.position);

    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position - 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Shift roles in a range down by 1.
 * Used when moving a role up in hierarchy.
 */
async function shiftRolesDownInRange(
    fromPosition: number,
    toPosition: number,
    tx: DbTransaction,
): Promise<void> {
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(
            and(
                sql`${role.position} >= ${fromPosition + 1}`,
                sql`${role.position} < ${toPosition + 1}`,
            ),
        )
        .orderBy(role.position);

    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position - 1 })
            .where(eq(role.id, r.id));
    }
}

/**
 * Shift roles in a range up by 1.
 * Used when moving a role down in hierarchy.
 */
async function shiftRolesUpInRange(
    fromPosition: number,
    toPosition: number,
    tx: DbTransaction,
): Promise<void> {
    const rolesToShift = await tx
        .select()
        .from(role)
        .where(
            and(
                sql`${role.position} >= ${toPosition}`,
                sql`${role.position} < ${fromPosition}`,
            ),
        )
        .orderBy(sql`${role.position} DESC`);

    for (const r of rolesToShift) {
        await tx
            .update(role)
            .set({ position: r.position + 1 })
            .where(eq(role.id, r.id));
    }
}

// =============================================================================
// Role CRUD
// =============================================================================

/**
 * Create a new role with automatic positioning.
 * The role is created at the creator's current position, and the creator is pushed up.
 *
 * Discord-like behavior:
 * - New role gets the creator's current position
 * - Creator and all roles >= creator's position get shifted up by 1
 *
 * @example
 * // Before: member(1), moderator(2), admin(4)
 * // Admin creates "event-manager"
 * const newRole = await createRole(adminId, {
 *     name: 'event-manager',
 *     permissions: ['events:view', 'events:create'],
 * });
 * // After: member(1), moderator(2), event-manager(4), admin(5)
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

    const newPosition = creatorPosition;
    const db = ctx.db;

    const result = await db.transaction(async (tx) => {
        await shiftRolesUp(newPosition, tx);

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
 * Create a role for testing purposes (bypasses hierarchy checks).
 */
export async function createTestingRole(
    ctx: AppContext,
    roleData: {
        name: string;
        description?: string;
        permissions?: string[];
        position: number;
    },
): Promise<typeof role.$inferSelect> {
    const db = ctx.db;
    const [newRole] = await db
        .insert(role)
        .values({
            name: roleData.name,
            description: roleData.description,
            position: roleData.position,
            permissions: roleData.permissions ?? [],
        })
        .returning();

    if (!newRole) {
        throw new Error("Failed to create testing role");
    }

    return newRole;
}

/**
 * Delete a role.
 * User must be able to manage the role (have higher position number).
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

    if (!(userPosition > targetRole.position)) {
        throw new Error("Cannot delete this role - insufficient hierarchy");
    }

    const db = ctx.db;
    await db.transaction(async (tx) => {
        await tx.delete(role).where(eq(role.id, roleId));
        await shiftRolesDown(targetRole.position, tx);
    });
}

/**
 * Reorder a role to a new position.
 * Validates hierarchy and automatically shifts other roles.
 *
 * Discord-like behavior:
 * - Can only move roles you can manage (position < your position)
 * - Cannot move your own highest role
 * - Can only move them to positions < your highest role
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

    if (targetRole.position > userPosition) {
        throw new Error("Cannot manage this role - insufficient hierarchy");
    }

    if (newPosition >= userPosition) {
        throw new Error("Cannot move role to or above your position");
    }

    const oldPosition = targetRole.position;

    if (oldPosition === newPosition) {
        return;
    }

    const db = ctx.db;
    await db.transaction(async (tx) => {
        if (newPosition > oldPosition) {
            await shiftRolesDownInRange(oldPosition, newPosition, tx);
        } else {
            await shiftRolesUpInRange(oldPosition, newPosition, tx);
        }

        await tx
            .update(role)
            .set({ position: newPosition })
            .where(eq(role.id, roleId));
    });
}
