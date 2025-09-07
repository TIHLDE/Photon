import { and, eq, inArray } from "drizzle-orm";
import db from "~/db";
import { permission, role, rolePermission, userRole } from "~/db/schema";

export async function getUserPermissions(userId: string): Promise<string[]> {
    const rows = await db
        .select({ name: permission.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
        .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
        .where(eq(userRole.userId, userId));
    const set = new Set(rows.map((r) => r.name));
    return [...set];
}

export async function userHasPermission(
    userId: string,
    permissionName: string,
): Promise<boolean> {
    const rows = await db
        .select({ name: permission.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
        .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
        .where(
            and(
                eq(userRole.userId, userId),
                eq(permission.name, permissionName),
            ),
        )
        .limit(1);
    return rows.length > 0;
}

export async function userHasAnyPermission(
    userId: string,
    permissions: string[],
): Promise<boolean> {
    if (permissions.length === 0) return false;
    const rows = await db
        .select({ name: permission.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
        .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
        .where(
            and(
                eq(userRole.userId, userId),
                inArray(permission.name, permissions),
            ),
        )
        .limit(1);
    return rows.length > 0;
}

export async function userHasAllPermissions(
    userId: string,
    permissions: string[],
): Promise<boolean> {
    if (permissions.length === 0) return true;
    const userPerms = await getUserPermissions(userId);
    const set = new Set(userPerms);
    return permissions.every((p) => set.has(p));
}
