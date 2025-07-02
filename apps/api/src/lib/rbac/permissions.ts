import { prisma } from "@photon/db";
import type { Permission } from "@photon/db";

export async function getUserWithRoles(userId: string) {
    return await prisma.user.findUnique({
        where: { id: userId },
        include: {
            userRoles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
}

export async function getUserPermissions(userId: string): Promise<string[]> {
    const user = await getUserWithRoles(userId);
    if (!user) return [];

    const permissions = new Set<string>();

    for (const userRole of user.userRoles) {
        for (const rolePermission of userRole.role.permissions) {
            permissions.add(rolePermission.permission.name);
        }
    }

    return Array.from(permissions);
}

export async function userHasPermission(
    userId: string,
    permission: string,
): Promise<boolean> {
    const permissions = await getUserPermissions(userId);
    return permissions.includes(permission);
}

export async function userHasAnyPermission(
    userId: string,
    permissions: string[],
): Promise<boolean> {
    const userPermissions = await getUserPermissions(userId);
    return permissions.some((permission) =>
        userPermissions.includes(permission),
    );
}

export async function userHasAllPermissions(
    userId: string,
    permissions: string[],
): Promise<boolean> {
    const userPermissions = await getUserPermissions(userId);
    return permissions.every((permission) =>
        userPermissions.includes(permission),
    );
}

export async function createPermission(
    name: string,
    description?: string,
    category?: string,
): Promise<Permission> {
    try {
        return await prisma.permission.create({
            data: {
                name,
                description,
                category,
            },
        });
    } catch (error) {
        console.error("Error creating permission:", error);
        throw error;
    }
}

export async function updatePermission(
    permissionId: string,
    data: {
        name?: string;
        description?: string;
        category?: string;
    },
): Promise<Permission> {
    try {
        return await prisma.permission.update({
            where: { id: permissionId },
            data,
        });
    } catch (error) {
        console.error("Error updating permission:", error);
        throw error;
    }
}

export async function deletePermission(permissionId: string): Promise<boolean> {
    try {
        await prisma.permission.delete({
            where: { id: permissionId },
        });
        return true;
    } catch (error) {
        console.error("Error deleting permission:", error);
        return false;
    }
}

export async function getAllPermissions(): Promise<Permission[]> {
    return await prisma.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
    });
}

export async function getAllPermissionsByCategory() {
    const permissions = await prisma.permission.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const grouped = permissions.reduce(
        (acc, permission) => {
            const category = permission.category || "uncategorized";
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(permission);
            return acc;
        },
        {} as Record<string, typeof permissions>,
    );

    return grouped;
}

export async function getPermissionByName(
    name: string,
): Promise<Permission | null> {
    return await prisma.permission.findUnique({
        where: { name },
    });
}

export async function getPermissionById(
    permissionId: string,
): Promise<Permission | null> {
    return await prisma.permission.findUnique({
        where: { id: permissionId },
    });
}

export async function getPermissionsByCategory(
    category: string,
): Promise<Permission[]> {
    return await prisma.permission.findMany({
        where: { category },
        orderBy: { name: "asc" },
    });
}
