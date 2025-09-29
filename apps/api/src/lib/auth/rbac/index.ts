import { getRedis } from "~/lib/cache/redis";
import { PERMISSIONS_SET } from "./permissions";
import {
    assignRolePermissions,
    assignUserRole,
    getRoleUserIds,
    getUserPermissions,
    getUserRoles,
    removeUserRole,
} from "./roles";

const userPermsCacheKey = (userId: string) => `rbac:user:${userId}:perms`;
const userRolesCacheKey = (userId: string) => `rbac:user:${userId}:roles`;

export async function getRolesForUser(userId: string): Promise<string[]> {
    const redis = await getRedis();
    const cacheKey = userRolesCacheKey(userId);
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const roles = await getUserRoles(userId);
    await redis.set(cacheKey, JSON.stringify(roles), { EX: 60 * 10 });
    return roles;
}

export async function getPermissionsForUser(userId: string): Promise<string[]> {
    const redis = await getRedis();
    const cacheKey = userPermsCacheKey(userId);
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    const raw = await getUserPermissions(userId);
    const value = raw.filter((n) => PERMISSIONS_SET.has(n));
    const deduped = [...new Set(value)];
    await redis.set(cacheKey, JSON.stringify(deduped), { EX: 60 * 10 });
    return deduped;
}

export async function userHasRoleName(
    userId: string,
    roleName: string,
): Promise<boolean> {
    const roles = await getRolesForUser(userId);
    return roles.includes(roleName);
}

export async function userHasAnyRoleName(
    userId: string,
    roleNames: string[],
): Promise<boolean> {
    if (roleNames.length === 0) return false;
    const roles = await getRolesForUser(userId);
    const set = new Set(roles);
    return roleNames.some((r) => set.has(r));
}

export async function userHasPermissionName(
    userId: string,
    permissionName: string,
): Promise<boolean> {
    const perms = await getPermissionsForUser(userId);
    return perms.includes(permissionName);
}

export async function userHasAnyPermissionName(
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    if (permissionNames.length === 0) return false;
    const perms = await getPermissionsForUser(userId);
    const set = new Set(perms);
    return permissionNames.some((p) => set.has(p));
}

export async function userHasAllPermissions(
    userId: string,
    permissionNames: string[],
): Promise<boolean> {
    const perms = await getPermissionsForUser(userId);
    const set = new Set(perms);
    return permissionNames.every((p) => set.has(p));
}

export async function assignRoleToUser(
    userId: string,
    roleName: string,
): Promise<void> {
    await assignUserRole(userId, roleName);
    const redis = await getRedis();
    await redis.del(userRolesCacheKey(userId));
    await redis.del(userPermsCacheKey(userId));
}

export async function removeRoleFromUser(
    userId: string,
    roleName: string,
): Promise<void> {
    await removeUserRole(userId, roleName);
    const redis = await getRedis();
    await redis.del(userRolesCacheKey(userId));
    await redis.del(userPermsCacheKey(userId));
}

export async function assignPermissionsToRole(
    roleName: string,
    permissionNames: string[],
): Promise<void> {
    if (permissionNames.length === 0) return;
    const invalid = permissionNames.filter((n) => !PERMISSIONS_SET.has(n));
    if (invalid.length) {
        throw new Error(
            `Invalid permissions (not in canonical list): ${invalid.join(", ")}`,
        );
    }
    await assignRolePermissions(roleName, permissionNames);
    const users = await getRoleUserIds(roleName);
    const redis = await getRedis();
    await Promise.all(
        users.flatMap((userId) => [
            redis.del(userRolesCacheKey(userId)),
            redis.del(userPermsCacheKey(userId)),
        ]),
    );
}
