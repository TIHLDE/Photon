// import { prisma } from "@photon/db";

// export async function assignRoleToUser(userId: string, roleName: string) {
//     try {
//         const role = await prisma.role.findUnique({
//             where: { name: roleName },
//         });

//         if (!role) {
//             return {
//                 success: false,
//                 error: `Role ${roleName} not found`,
//             };
//         }

//         await prisma.userRole.upsert({
//             where: {
//                 userId_roleId: {
//                     userId,
//                     roleId: role.id,
//                 },
//             },
//             update: {},
//             create: {
//                 userId,
//                 roleId: role.id,
//             },
//         });

//         return { success: true };
//     } catch (error) {
//         console.error("Error assigning role to user:", error);
//         return {
//             success: false,
//             error: error instanceof Error ? error.message : "Unknown error",
//         };
//     }
// }

// export async function removeRoleFromUser(userId: string, roleName: string) {
//     try {
//         const role = await prisma.role.findUnique({
//             where: { name: roleName },
//         });

//         if (!role) {
//             return {
//                 success: false,
//                 error: `Role ${roleName} not found`,
//             };
//         }

//         await prisma.userRole.deleteMany({
//             where: {
//                 userId,
//                 roleId: role.id,
//             },
//         });

//         return { success: true };
//     } catch (error) {
//         console.error("Error removing role from user:", error);
//         return {
//             success: false,
//             error: error instanceof Error ? error.message : "Unknown error",
//         };
//     }
// }

// export async function assignRolesToUser(userId: string, roleNames: string[]) {
//     try {
//         const roles = await prisma.role.findMany({
//             where: { name: { in: roleNames } },
//         });

//         if (roles.length !== roleNames.length) {
//             const foundRoleNames = roles.map((r) => r.name);
//             const missingRoles = roleNames.filter(
//                 (name) => !foundRoleNames.includes(name),
//             );
//             return {
//                 success: false,
//                 error: `Roles not found: ${missingRoles.join(", ")}`,
//             };
//         }

//         await prisma.$transaction([
//             prisma.userRole.deleteMany({
//                 where: { userId },
//             }),
//             prisma.userRole.createMany({
//                 data: roles.map((role) => ({
//                     userId,
//                     roleId: role.id,
//                 })),
//             }),
//         ]);

//         return { success: true };
//     } catch (error) {
//         console.error("Error assigning roles to user:", error);
//         return {
//             success: false,
//             error: error instanceof Error ? error.message : "Unknown error",
//         };
//     }
// }

// export async function assignPermissionToRole(
//     roleName: string,
//     permissionName: string,
// ) {
//     try {
//         const [role, permission] = await Promise.all([
//             prisma.role.findUnique({ where: { name: roleName } }),
//             prisma.permission.findUnique({ where: { name: permissionName } }),
//         ]);

//         if (!role || !permission) {
//             return {
//                 success: false,
//                 error: `Role ${roleName} or permission ${permissionName} not found`,
//             };
//         }

//         await prisma.rolePermission.upsert({
//             where: {
//                 roleId_permissionId: {
//                     roleId: role.id,
//                     permissionId: permission.id,
//                 },
//             },
//             update: {},
//             create: {
//                 roleId: role.id,
//                 permissionId: permission.id,
//             },
//         });

//         return { success: true };
//     } catch (error) {
//         console.error("Error assigning permission to role:", error);
//         return {
//             success: false,
//             error: error instanceof Error ? error.message : "Unknown error",
//         };
//     }
// }

// export async function removePermissionFromRole(
//     roleName: string,
//     permissionName: string,
// ) {
//     try {
//         const [role, permission] = await Promise.all([
//             prisma.role.findUnique({ where: { name: roleName } }),
//             prisma.permission.findUnique({ where: { name: permissionName } }),
//         ]);

//         if (!role || !permission) {
//             return {
//                 success: false,
//                 error: `Role ${roleName} or permission ${permissionName} not found`,
//             };
//         }

//         await prisma.rolePermission.deleteMany({
//             where: {
//                 roleId: role.id,
//                 permissionId: permission.id,
//             },
//         });

//         return { success: true };
//     } catch (error) {
//         console.error("Error removing permission from role:", error);
//         return {
//             success: false,
//             error: error instanceof Error ? error.message : "Unknown error",
//         };
//     }
// }

// export async function assignPermissionsToRole(
//     roleName: string,
//     permissionNames: string[],
// ) {
//     try {
//         const [role, permissions] = await Promise.all([
//             prisma.role.findUnique({ where: { name: roleName } }),
//             prisma.permission.findMany({
//                 where: { name: { in: permissionNames } },
//             }),
//         ]);

//         if (!role) {
//             return {
//                 success: false,
//                 error: `Role ${roleName} not found`,
//             };
//         }

//         if (permissions.length !== permissionNames.length) {
//             const foundPermissionNames = permissions.map((p) => p.name);
//             const missingPermissions = permissionNames.filter(
//                 (name) => !foundPermissionNames.includes(name),
//             );
//             return {
//                 success: false,
//                 error: `Permissions not found: ${missingPermissions.join(", ")}`,
//             };
//         }

//         await prisma.$transaction([
//             prisma.rolePermission.deleteMany({
//                 where: { roleId: role.id },
//             }),
//             prisma.rolePermission.createMany({
//                 data: permissions.map((permission) => ({
//                     roleId: role.id,
//                     permissionId: permission.id,
//                 })),
//             }),
//         ]);

//         return { success: true };
//     } catch (error) {
//         console.error("Error assigning permissions to role:", error);
//         return {
//             success: false,
//             error: error instanceof Error ? error.message : "Unknown error",
//         };
//     }
// }
