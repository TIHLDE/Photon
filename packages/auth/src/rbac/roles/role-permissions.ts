/**
 * Role permission management functions.
 *
 * This module provides functions to manage the permissions assigned to roles.
 */

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { role } from "@photon/db/schema";
import type { DbSchema } from "@photon/db";

type DbCtx = { db: NodePgDatabase<DbSchema> };
import { getRoleByName } from "./queries";

/**
 * Assign (merge) permissions to a role.
 * Adds new permissions without removing existing ones.
 * Throws if role doesn't exist.
 */
export async function assignRolePermissions(
    ctx: DbCtx,
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
    ctx: DbCtx,
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
