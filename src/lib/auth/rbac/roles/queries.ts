/**
 * Role query functions.
 *
 * This module provides functions to retrieve roles from the database.
 */

import { eq, sql } from "drizzle-orm";
import { role } from "~/db/schema";
import type { AppContext } from "~/lib/ctx";

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
