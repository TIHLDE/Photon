// export async function getUserPermissions(userId: string): Promise<string[]> {
//     const user = await getUserWithRolesById(userId);
//     if (!user) return [];

//     const permissions = new Set<string>();

//     for (const userRole of user.userRoles) {
//         for (const rolePermission of userRole.role.permissions) {
//             permissions.add(rolePermission.permission.name);
//         }
//     }

//     return Array.from(permissions);
// }

// export async function userHasPermission(
//     userId: string,
//     permission: string,
// ): Promise<boolean> {
//     const permissions = await getUserPermissions(userId);
//     return permissions.includes(permission);
// }

// export async function userHasAnyPermission(
//     userId: string,
//     permissions: string[],
// ): Promise<boolean> {
//     const userPermissions = await getUserPermissions(userId);
//     return permissions.some((permission) =>
//         userPermissions.includes(permission),
//     );
// }

// export async function userHasAllPermissions(
//     userId: string,
//     permissions: string[],
// ): Promise<boolean> {
//     const userPermissions = await getUserPermissions(userId);
//     return permissions.every((permission) =>
//         userPermissions.includes(permission),
//     );
// }
