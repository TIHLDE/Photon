import { prisma } from "@photon/db";
import type { Role } from "@photon/db";
import { getUserWithRoles } from "./permissions";

export async function getUserRoles(userId: string): Promise<string[]> {
    const user = await getUserWithRoles(userId);
    if (!user) return [];

    return user.userRoles.map((userRole) => userRole.role.name);
}

export async function userHasRole(
    userId: string,
    roleName: string,
): Promise<boolean> {
    const roles = await getUserRoles(userId);
    return roles.includes(roleName);
}

export async function userHasAnyRole(
    userId: string,
    roleNames: string[],
): Promise<boolean> {
    const userRoles = await getUserRoles(userId);
    return roleNames.some((role) => userRoles.includes(role));
}

export async function getUserHighestRolePosition(
    userId: string,
): Promise<number | null> {
    const user = await getUserWithRoles(userId);
    if (!user || user.userRoles.length === 0) return null;

    return Math.min(
        ...user.userRoles.map((userRole) => userRole.role.position),
    );
}

export async function userCanManageUser(
    managerId: string,
    targetUserId: string,
): Promise<boolean> {
    const [managerPosition, targetPosition] = await Promise.all([
        getUserHighestRolePosition(managerId),
        getUserHighestRolePosition(targetUserId),
    ]);

    // If either user has no roles, deny access
    if (managerPosition === null || targetPosition === null) return false;

    // Lower position number = higher authority
    return managerPosition < targetPosition;
}

export async function createRole(
    name: string,
    description?: string,
    color?: string,
    position?: number,
): Promise<Role> {
    try {
        return await prisma.role.create({
            data: {
                name,
                description,
                color,
                position: position ?? 999,
            },
        });
    } catch (error) {
        console.error("Error creating role:", error);
        throw error;
    }
}

export async function updateRole(
    roleId: string,
    data: {
        name?: string;
        description?: string;
        color?: string;
        position?: number;
    },
): Promise<Role> {
    try {
        return await prisma.role.update({
            where: { id: roleId },
            data,
        });
    } catch (error) {
        console.error("Error updating role:", error);
        throw error;
    }
}

export async function deleteRole(roleId: string): Promise<boolean> {
    try {
        await prisma.role.delete({
            where: { id: roleId },
        });
        return true;
    } catch (error) {
        console.error("Error deleting role:", error);
        return false;
    }
}

export async function getAllRolesWithPermissions() {
    return await prisma.role.findMany({
        include: {
            permissions: {
                include: {
                    permission: true,
                },
            },
            _count: {
                select: {
                    userRoles: true,
                },
            },
        },
        orderBy: {
            position: "asc",
        },
    });
}

export async function getAllRoles(): Promise<Role[]> {
    return await prisma.role.findMany({
        orderBy: {
            position: "asc",
        },
    });
}

export async function getRoleByName(name: string): Promise<Role | null> {
    return await prisma.role.findUnique({
        where: { name },
    });
}

export async function getRoleById(roleId: string): Promise<Role | null> {
    return await prisma.role.findUnique({
        where: { id: roleId },
    });
}

export async function getRoleWithPermissions(roleId: string) {
    return await prisma.role.findUnique({
        where: { id: roleId },
        include: {
            permissions: {
                include: {
                    permission: true,
                },
            },
            _count: {
                select: {
                    userRoles: true,
                },
            },
        },
    });
}
