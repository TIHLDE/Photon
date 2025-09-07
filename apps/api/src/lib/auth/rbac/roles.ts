import { and, eq, inArray } from "drizzle-orm";
import db from "~/db";
import { role, userRole } from "~/db/schema";

export async function getUserRoles(userId: string): Promise<string[]> {
    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));

    return rows.map((r) => r.name);
}

export async function userHasRole(
    userId: string,
    roleName: string,
): Promise<boolean> {
    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(and(eq(userRole.userId, userId), eq(role.name, roleName)))
        .limit(1);
    return rows.length > 0;
}

export async function userHasAnyRole(
    userId: string,
    roleNames: string[],
): Promise<boolean> {
    if (roleNames.length === 0) return false;
    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(and(eq(userRole.userId, userId), inArray(role.name, roleNames)))
        .limit(1);
    return rows.length > 0;
}

export async function getUserHighestRolePosition(
    userId: string,
): Promise<number | null> {
    const rows = await db
        .select({ position: role.position })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));
    if (rows.length === 0) return null;
    return Math.min(...rows.map((r) => r.position));
}

export async function userCanManageUser(
    managerId: string,
    targetUserId: string,
): Promise<boolean> {
    const [managerPosition, targetPosition] = await Promise.all([
        getUserHighestRolePosition(managerId),
        getUserHighestRolePosition(targetUserId),
    ]);

    if (managerPosition === null || targetPosition === null) return false;
    return managerPosition < targetPosition;
}
