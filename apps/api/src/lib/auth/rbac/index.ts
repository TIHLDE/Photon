import { and, eq, inArray } from "drizzle-orm";
import { permission, role, rolePermission, userRole } from "~/db/schema";
import type { AppContext } from "~/lib/context";

const userPermsCacheKey = (userId: string) => `rbac:user:${userId}:perms`;
const userRolesCacheKey = (userId: string) => `rbac:user:${userId}:roles`;

export async function getRolesForUser(
    ctx: AppContext,
    userId: string,
): Promise<string[]> {
    const { db, redis } = ctx;
    const cacheKey = userRolesCacheKey(userId);

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await db
        .select({ name: role.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .where(eq(userRole.userId, userId));
    const value = rows.map((r) => r.name);

    await redis.set(cacheKey, JSON.stringify(value), { EX: 60 * 10 });
    return value;
}

export async function getPermissionsForUser(
    ctx: AppContext,
    userId: string,
): Promise<string[]> {
    const { db, redis } = ctx;
    const cacheKey = userPermsCacheKey(userId);

    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await db
        .select({ name: permission.name })
        .from(userRole)
        .innerJoin(role, eq(userRole.roleId, role.id))
        .innerJoin(rolePermission, eq(rolePermission.roleId, role.id))
        .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
        .where(eq(userRole.userId, userId));
    const set = new Set(rows.map((r) => r.name));
    const value = [...set];

    await redis.set(cacheKey, JSON.stringify(value), { EX: 60 * 10 });
    return value;
}

export async function userHasRoleName(
    ctx: AppContext,
    userId: string,
    roleName: string,
): Promise<boolean> {
    const roles = await getRolesForUser(ctx, userId);
    return roles.includes(roleName);
}

export async function userHasAnyRoleName(
    ctx: AppContext,
    userId: string,
    roleNames: string[],
): Promise<boolean> {
    if (roleNames.length === 0) return false;
    const roles = await getRolesForUser(ctx, userId);
    const set = new Set(roles);
    return roleNames.some((r) => set.has(r));
}

export async function userHasPermissionName(
    ctx: AppContext,
    userId: string,
    permissionName: string,
): Promise<boolean> {
    const perms = await getPermissionsForUser(ctx, userId);
    return perms.includes(permissionName);
}

export async function userHasAnyPermissionName(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;
    const perms = await getPermissionsForUser(ctx, userId);
    const set = new Set(perms);
    return permissionNames.some((p) => set.has(p));
}

export async function userHasAllPermissions(
    ctx: AppContext,
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    const perms = await getPermissionsForUser(ctx, userId);
    const set = new Set(perms);
    return permissionNames.every((p) => set.has(p));
}

export async function assignRoleToUser(
    ctx: AppContext,
    userId: string,
    roleName: string,
): Promise<void> {
    const { db, redis } = ctx;
    const [r] = await db.select().from(role).where(eq(role.name, roleName));
    if (!r) throw new Error(`Role not found: ${roleName}`);

    await db
        .insert(userRole)
        .values({ userId, roleId: r.id })
        .onConflictDoNothing();

    await redis.del(userRolesCacheKey(userId));
    await redis.del(userPermsCacheKey(userId));
}

export async function removeRoleFromUser(
    ctx: AppContext,
    userId: string,
    roleName: string,
): Promise<void> {
    const { db, redis } = ctx;
    const [r] = await db.select().from(role).where(eq(role.name, roleName));
    if (!r) return;

    await db
        .delete(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.roleId, r.id)));

    await redis.del(userRolesCacheKey(userId));
    await redis.del(userPermsCacheKey(userId));
}

export async function assignPermissionsToRole(
    ctx: AppContext,
    roleName: string,
    permissionNames: string[],
): Promise<void> {
    const { db, redis } = ctx;
    const [r] = await db.select().from(role).where(eq(role.name, roleName));
    if (!r) throw new Error(`Role not found: ${roleName}`);

    if (permissionNames.length === 0) return;
    const perms = await db
        .select()
        .from(permission)
        .where(inArray(permission.name, permissionNames));
    const nameToPerm = new Map(perms.map((p) => [p.name, p] as const));
    const missing = permissionNames.filter((n) => !nameToPerm.has(n));
    if (missing.length)
        throw new Error(`Permissions not found: ${missing.join(", ")}`);

    await db
        .insert(rolePermission)
        .values(perms.map((p) => ({ roleId: r.id, permissionId: p.id })))
        .onConflictDoNothing();

    // Invalidate all users who have this role
    const usersWithRole = await db
        .select({ userId: userRole.userId })
        .from(userRole)
        .where(eq(userRole.roleId, r.id));
    await Promise.all(
        usersWithRole.flatMap((u) => [
            redis.del(userRolesCacheKey(u.userId)),
            redis.del(userPermsCacheKey(u.userId)),
        ]),
    );
}
