/**
 * Role CRUD operations.
 *
 * This module provides functions to create, delete, and reorder roles,
 * including automatic position management and hierarchy validation.
 */

import type { DbSchema, DbTransaction } from "@photon/db";
import { role } from "@photon/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getUserHighestRolePosition } from "./hierarchy";
import { getRoleById } from "./queries";

// =============================================================================
// Position Shifting Helpers (Internal)
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
    ctx: { db: NodePgDatabase<DbSchema> },
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
    ctx: { db: NodePgDatabase<DbSchema> },
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
    ctx: { db: NodePgDatabase<DbSchema> },
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
    ctx: { db: NodePgDatabase<DbSchema> },
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
