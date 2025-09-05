// export async function getUserRoles(userId: string): Promise<string[]> {
//     const user = await getUserWithRolesById(userId);
//     if (!user) return [];

//     return user.userRoles.map((userRole) => userRole.role.name);
// }

// export async function userHasRole(
//     userId: string,
//     roleName: string,
// ): Promise<boolean> {
//     const roles = await getUserRoles(userId);
//     return roles.includes(roleName);
// }

// export async function userHasAnyRole(
//     userId: string,
//     roleNames: string[],
// ): Promise<boolean> {
//     const userRoles = await getUserRoles(userId);
//     return roleNames.some((role) => userRoles.includes(role));
// }

// async function getUserHighestRolePosition(
//     userId: string,
// ): Promise<number | null> {
//     const user = await getUserWithRolesById(userId);
//     if (!user || user.userRoles.length === 0) return null;

//     return Math.min(
//         ...user.userRoles.map((userRole) => userRole.role.position),
//     );
// }

// export async function userCanManageUser(
//     managerId: string,
//     targetUserId: string,
// ): Promise<boolean> {
//     const [managerPosition, targetPosition] = await Promise.all([
//         getUserHighestRolePosition(managerId),
//         getUserHighestRolePosition(targetUserId),
//     ]);

//     if (managerPosition === null || targetPosition === null) return false;

//     return managerPosition < targetPosition;
// }
