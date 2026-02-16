import {
    assignRolePermissions,
    assignUserRole,
    createRole,
    createTestingRole,
    deleteRole,
    getAllRoles,
    getRoleById,
    getRoleByName,
    getUserHighestRolePosition,
    getUserRoles,
    removeUserRole,
    reorderRole,
    setRolePermissions,
    userCanManageUser,
    userHasAnyRole,
    userHasRole,
} from "@photon/auth/server";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("RBAC role system", () => {
    describe("role queries", () => {
        integrationTest(
            "getRoleByName returns role when exists",
            async ({ ctx }) => {
                await createTestingRole(ctx, {
                    name: "test-role",
                    position: 5,
                    permissions: ["users:view"],
                    description: "Test role",
                });

                const role = await getRoleByName(ctx, "test-role");

                expect(role).not.toBeNull();
                expect(role?.name).toBe("test-role");
                expect(role?.position).toBe(5);
                expect(role?.permissions).toContain("users:view");
            },
            500_000,
        );

        integrationTest(
            "getRoleByName returns null when role does not exist",
            async ({ ctx }) => {
                const role = await getRoleByName(ctx, "nonexistent-role");
                expect(role).toBeNull();
            },
            500_000,
        );

        integrationTest(
            "getRoleById returns role when exists",
            async ({ ctx }) => {
                const created = await createTestingRole(ctx, {
                    name: "test-role-by-id",
                    position: 3,
                    permissions: [],
                });

                const role = await getRoleById(ctx, created.id);

                expect(role).not.toBeNull();
                expect(role?.id).toBe(created.id);
                expect(role?.name).toBe("test-role-by-id");
            },
            500_000,
        );

        integrationTest(
            "getAllRoles returns roles ordered by position descending",
            async ({ ctx }) => {
                await createTestingRole(ctx, {
                    name: "low-role",
                    position: 1,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "high-role",
                    position: 10,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "mid-role",
                    position: 5,
                    permissions: [],
                });

                const roles = await getAllRoles(ctx);

                expect(roles.length).toBeGreaterThanOrEqual(3);
                // Should be ordered by position descending (highest first)
                const positions = roles.map((r) => r.position);
                for (let i = 1; i < positions.length; i++) {
                    const prev = positions[i - 1];
                    const curr = positions[i];
                    if (prev !== undefined && curr !== undefined) {
                        expect(curr).toBeLessThanOrEqual(prev);
                    }
                }
            },
            500_000,
        );
    });

    describe("user-role operations", () => {
        integrationTest(
            "assignUserRole assigns role to user",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "member",
                    position: 1,
                    permissions: [],
                });

                await assignUserRole(ctx, user.id, "member");

                const roles = await getUserRoles(ctx, user.id);
                expect(roles).toContain("member");
            },
            500_000,
        );

        integrationTest(
            "assignUserRole throws when role does not exist",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();

                await expect(
                    assignUserRole(ctx, user.id, "nonexistent"),
                ).rejects.toThrow("Role not found: nonexistent");
            },
            500_000,
        );

        integrationTest(
            "assignUserRole is idempotent (does nothing if already assigned)",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "idempotent-role",
                    position: 1,
                    permissions: [],
                });

                await assignUserRole(ctx, user.id, "idempotent-role");
                await assignUserRole(ctx, user.id, "idempotent-role"); // Should not throw

                const roles = await getUserRoles(ctx, user.id);
                expect(
                    roles.filter((r) => r === "idempotent-role").length,
                ).toBe(1);
            },
            500_000,
        );

        integrationTest(
            "removeUserRole removes role from user",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "removable-role",
                    position: 1,
                    permissions: [],
                });

                await assignUserRole(ctx, user.id, "removable-role");
                let roles = await getUserRoles(ctx, user.id);
                expect(roles).toContain("removable-role");

                await removeUserRole(ctx, user.id, "removable-role");
                roles = await getUserRoles(ctx, user.id);
                expect(roles).not.toContain("removable-role");
            },
            500_000,
        );

        integrationTest(
            "removeUserRole does nothing if role does not exist",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();

                // Should not throw
                await removeUserRole(ctx, user.id, "nonexistent-role");
            },
            500_000,
        );

        integrationTest(
            "userHasRole returns true when user has role",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "check-role",
                    position: 1,
                    permissions: [],
                });
                await assignUserRole(ctx, user.id, "check-role");

                const hasRole = await userHasRole(ctx, user.id, "check-role");
                expect(hasRole).toBe(true);
            },
            500_000,
        );

        integrationTest(
            "userHasRole returns false when user does not have role",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "unassigned-role",
                    position: 1,
                    permissions: [],
                });

                const hasRole = await userHasRole(
                    ctx,
                    user.id,
                    "unassigned-role",
                );
                expect(hasRole).toBe(false);
            },
            500_000,
        );

        integrationTest(
            "userHasAnyRole returns true when user has at least one role",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "role-a",
                    position: 1,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "role-b",
                    position: 2,
                    permissions: [],
                });
                await assignUserRole(ctx, user.id, "role-a");

                const hasAny = await userHasAnyRole(ctx, user.id, [
                    "role-a",
                    "role-b",
                ]);
                expect(hasAny).toBe(true);
            },
            500_000,
        );

        integrationTest(
            "userHasAnyRole returns false when user has none of the roles",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "other-role-a",
                    position: 1,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "other-role-b",
                    position: 2,
                    permissions: [],
                });

                const hasAny = await userHasAnyRole(ctx, user.id, [
                    "other-role-a",
                    "other-role-b",
                ]);
                expect(hasAny).toBe(false);
            },
            500_000,
        );

        integrationTest(
            "userHasAnyRole returns false for empty role array",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();

                const hasAny = await userHasAnyRole(ctx, user.id, []);
                expect(hasAny).toBe(false);
            },
            500_000,
        );
    });

    describe("role hierarchy", () => {
        integrationTest(
            "getUserHighestRolePosition returns highest position",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "low",
                    position: 1,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "high",
                    position: 10,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "mid",
                    position: 5,
                    permissions: [],
                });

                await assignUserRole(ctx, user.id, "low");
                await assignUserRole(ctx, user.id, "high");
                await assignUserRole(ctx, user.id, "mid");

                const position = await getUserHighestRolePosition(ctx, user.id);
                expect(position).toBe(10);
            },
            500_000,
        );

        integrationTest(
            "getUserHighestRolePosition returns null for user with no roles",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();

                const position = await getUserHighestRolePosition(ctx, user.id);
                expect(position).toBeNull();
            },
            500_000,
        );

        integrationTest(
            "userCanManageUser returns true when manager has higher position",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const moderator = await ctx.utils.createTestUser();

                await createTestingRole(ctx, {
                    name: "admin-role",
                    position: 10,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "moderator-role",
                    position: 5,
                    permissions: [],
                });

                await assignUserRole(ctx, admin.id, "admin-role");
                await assignUserRole(ctx, moderator.id, "moderator-role");

                const canManage = await userCanManageUser(
                    ctx,
                    admin.id,
                    moderator.id,
                );
                expect(canManage).toBe(true);
            },
            500_000,
        );

        integrationTest(
            "userCanManageUser returns false when manager has lower position",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const moderator = await ctx.utils.createTestUser();

                await createTestingRole(ctx, {
                    name: "admin-role-2",
                    position: 10,
                    permissions: [],
                });
                await createTestingRole(ctx, {
                    name: "moderator-role-2",
                    position: 5,
                    permissions: [],
                });

                await assignUserRole(ctx, admin.id, "admin-role-2");
                await assignUserRole(ctx, moderator.id, "moderator-role-2");

                const canManage = await userCanManageUser(
                    ctx,
                    moderator.id,
                    admin.id,
                );
                expect(canManage).toBe(false);
            },
            500_000,
        );

        integrationTest(
            "userCanManageUser returns false when positions are equal (cannot manage peers)",
            async ({ ctx }) => {
                const user1 = await ctx.utils.createTestUser();
                const user2 = await ctx.utils.createTestUser();

                await createTestingRole(ctx, {
                    name: "peer-role",
                    position: 5,
                    permissions: [],
                });

                await assignUserRole(ctx, user1.id, "peer-role");
                await assignUserRole(ctx, user2.id, "peer-role");

                const canManage = await userCanManageUser(
                    ctx,
                    user1.id,
                    user2.id,
                );
                expect(canManage).toBe(false);
            },
            500_000,
        );

        integrationTest(
            "userCanManageUser returns false when manager has no roles",
            async ({ ctx }) => {
                const noRoleUser = await ctx.utils.createTestUser();
                const targetUser = await ctx.utils.createTestUser();

                await createTestingRole(ctx, {
                    name: "some-role",
                    position: 1,
                    permissions: [],
                });
                await assignUserRole(ctx, targetUser.id, "some-role");

                const canManage = await userCanManageUser(
                    ctx,
                    noRoleUser.id,
                    targetUser.id,
                );
                expect(canManage).toBe(false);
            },
            500_000,
        );
    });

    describe("role permission management", () => {
        integrationTest(
            "assignRolePermissions merges new permissions",
            async ({ ctx }) => {
                await createTestingRole(ctx, {
                    name: "perm-role",
                    position: 1,
                    permissions: ["users:view"],
                });

                await assignRolePermissions(ctx, "perm-role", [
                    "users:create",
                    "users:update",
                ]);

                const role = await getRoleByName(ctx, "perm-role");
                expect(role?.permissions).toContain("users:view");
                expect(role?.permissions).toContain("users:create");
                expect(role?.permissions).toContain("users:update");
            },
            500_000,
        );

        integrationTest(
            "assignRolePermissions does not duplicate existing permissions",
            async ({ ctx }) => {
                await createTestingRole(ctx, {
                    name: "dup-perm-role",
                    position: 1,
                    permissions: ["users:view", "users:create"],
                });

                await assignRolePermissions(ctx, "dup-perm-role", [
                    "users:view", // Already exists
                    "users:delete", // New
                ]);

                const role = await getRoleByName(ctx, "dup-perm-role");
                const viewCount = role?.permissions?.filter(
                    (p) => p === "users:view",
                ).length;
                expect(viewCount).toBe(1);
                expect(role?.permissions).toContain("users:delete");
            },
            500_000,
        );

        integrationTest(
            "assignRolePermissions throws when role does not exist",
            async ({ ctx }) => {
                await expect(
                    assignRolePermissions(ctx, "nonexistent-role", [
                        "users:view",
                    ]),
                ).rejects.toThrow("Role not found: nonexistent-role");
            },
            500_000,
        );

        integrationTest(
            "setRolePermissions replaces all permissions",
            async ({ ctx }) => {
                await createTestingRole(ctx, {
                    name: "replace-perm-role",
                    position: 1,
                    permissions: ["users:view", "users:create", "users:update"],
                });

                await setRolePermissions(ctx, "replace-perm-role", [
                    "events:view",
                ]);

                const role = await getRoleByName(ctx, "replace-perm-role");
                expect(role?.permissions).toEqual(["events:view"]);
            },
            500_000,
        );

        integrationTest(
            "setRolePermissions throws when role does not exist",
            async ({ ctx }) => {
                await expect(
                    setRolePermissions(ctx, "nonexistent-role", ["users:view"]),
                ).rejects.toThrow("Role not found: nonexistent-role");
            },
            500_000,
        );
    });

    describe("role creation with hierarchy", () => {
        integrationTest(
            "createRole creates role at creator's position and shifts others up",
            async ({ ctx }) => {
                // Setup: create admin user with position 10
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin");

                // Create an existing role at position 5
                await createTestingRole(ctx, {
                    name: "moderator",
                    position: 5,
                    permissions: [],
                });

                // Admin creates a new role
                const newRole = await createRole(ctx, admin.id, {
                    name: "event-manager",
                    permissions: ["events:view", "events:create"],
                });

                // New role should be at admin's position (10)
                expect(newRole.position).toBe(10);
                expect(newRole.name).toBe("event-manager");

                // Admin should have been shifted up to 11
                const adminRole = await getRoleByName(ctx, "admin");
                expect(adminRole?.position).toBe(11);

                // Moderator should remain at 5 (below the new role's position)
                const modRole = await getRoleByName(ctx, "moderator");
                expect(modRole?.position).toBe(5);
            },
            500_000,
        );

        integrationTest(
            "createRole throws when creator has no roles",
            async ({ ctx }) => {
                const noRoleUser = await ctx.utils.createTestUser();

                await expect(
                    createRole(ctx, noRoleUser.id, {
                        name: "should-fail",
                        permissions: [],
                    }),
                ).rejects.toThrow("User has no roles and cannot create roles");
            },
            500_000,
        );
    });

    describe("role deletion", () => {
        integrationTest(
            "deleteRole deletes role when user has higher position",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-delete",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-delete");

                const toDelete = await createTestingRole(ctx, {
                    name: "to-delete",
                    position: 5,
                    permissions: [],
                });

                await deleteRole(ctx, admin.id, toDelete.id);

                const deleted = await getRoleByName(ctx, "to-delete");
                expect(deleted).toBeNull();
            },
            500_000,
        );

        integrationTest(
            "deleteRole shifts other roles down after deletion",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-shift",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-shift");

                const toDelete = await createTestingRole(ctx, {
                    name: "middle-role",
                    position: 5,
                    permissions: [],
                });

                await createTestingRole(ctx, {
                    name: "above-deleted",
                    position: 7,
                    permissions: [],
                });

                await deleteRole(ctx, admin.id, toDelete.id);

                // Role above deleted position should shift down by 1
                const aboveRole = await getRoleByName(ctx, "above-deleted");
                expect(aboveRole?.position).toBe(6);

                // Admin role should also shift down
                const adminRole = await getRoleByName(ctx, "admin-shift");
                expect(adminRole?.position).toBe(9);
            },
            500_000,
        );

        integrationTest(
            "deleteRole throws when user has no roles",
            async ({ ctx }) => {
                const noRoleUser = await ctx.utils.createTestUser();
                const toDelete = await createTestingRole(ctx, {
                    name: "cannot-delete",
                    position: 1,
                    permissions: [],
                });

                await expect(
                    deleteRole(ctx, noRoleUser.id, toDelete.id),
                ).rejects.toThrow("User has no roles");
            },
            500_000,
        );

        integrationTest(
            "deleteRole throws when role does not exist",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-no-role",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-no-role");

                await expect(deleteRole(ctx, admin.id, 99999)).rejects.toThrow(
                    "Role not found",
                );
            },
            500_000,
        );

        integrationTest(
            "deleteRole throws when user has insufficient hierarchy",
            async ({ ctx }) => {
                const lowUser = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "low-role",
                    position: 3,
                    permissions: [],
                });
                await assignUserRole(ctx, lowUser.id, "low-role");

                const highRole = await createTestingRole(ctx, {
                    name: "high-role",
                    position: 10,
                    permissions: [],
                });

                await expect(
                    deleteRole(ctx, lowUser.id, highRole.id),
                ).rejects.toThrow(
                    "Cannot delete this role - insufficient hierarchy",
                );
            },
            500_000,
        );

        integrationTest(
            "deleteRole throws when trying to delete role at same position",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const sameRole = await createTestingRole(ctx, {
                    name: "same-position",
                    position: 5,
                    permissions: [],
                });
                await assignUserRole(ctx, user.id, "same-position");

                await expect(
                    deleteRole(ctx, user.id, sameRole.id),
                ).rejects.toThrow(
                    "Cannot delete this role - insufficient hierarchy",
                );
            },
            500_000,
        );
    });

    describe("role reordering", () => {
        integrationTest(
            "reorderRole moves role to higher position",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-reorder",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-reorder");

                const toMove = await createTestingRole(ctx, {
                    name: "move-up",
                    position: 3,
                    permissions: [],
                });

                await createTestingRole(ctx, {
                    name: "in-between",
                    position: 5,
                    permissions: [],
                });

                await reorderRole(ctx, admin.id, toMove.id, 7);

                const movedRole = await getRoleByName(ctx, "move-up");
                expect(movedRole?.position).toBe(7);

                // Role in between should shift down
                const betweenRole = await getRoleByName(ctx, "in-between");
                expect(betweenRole?.position).toBe(4);
            },
            500_000,
        );

        integrationTest(
            "reorderRole moves role to lower position",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-reorder-down",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-reorder-down");

                const toMove = await createTestingRole(ctx, {
                    name: "move-down",
                    position: 7,
                    permissions: [],
                });

                await createTestingRole(ctx, {
                    name: "in-between-down",
                    position: 5,
                    permissions: [],
                });

                await reorderRole(ctx, admin.id, toMove.id, 3);

                const movedRole = await getRoleByName(ctx, "move-down");
                expect(movedRole?.position).toBe(3);

                // Role in between should shift up
                const betweenRole = await getRoleByName(ctx, "in-between-down");
                expect(betweenRole?.position).toBe(6);
            },
            500_000,
        );

        integrationTest(
            "reorderRole does nothing when position unchanged",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-no-change",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-no-change");

                const toMove = await createTestingRole(ctx, {
                    name: "no-change",
                    position: 5,
                    permissions: [],
                });

                await reorderRole(ctx, admin.id, toMove.id, 5);

                const role = await getRoleByName(ctx, "no-change");
                expect(role?.position).toBe(5);
            },
            500_000,
        );

        integrationTest(
            "reorderRole throws when user has no roles",
            async ({ ctx }) => {
                const noRoleUser = await ctx.utils.createTestUser();
                const toMove = await createTestingRole(ctx, {
                    name: "cannot-reorder",
                    position: 5,
                    permissions: [],
                });

                await expect(
                    reorderRole(ctx, noRoleUser.id, toMove.id, 3),
                ).rejects.toThrow("User has no roles");
            },
            500_000,
        );

        integrationTest(
            "reorderRole throws when role does not exist",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-role-exist",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-role-exist");

                await expect(
                    reorderRole(ctx, admin.id, 99999, 5),
                ).rejects.toThrow("Role not found");
            },
            500_000,
        );

        integrationTest(
            "reorderRole throws when trying to modify highest role",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const highestRole = await createTestingRole(ctx, {
                    name: "my-highest",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, user.id, "my-highest");

                await expect(
                    reorderRole(ctx, user.id, highestRole.id, 5),
                ).rejects.toThrow("Cannot modify your highest role");
            },
            500_000,
        );

        integrationTest(
            "reorderRole throws when trying to manage role with higher position",
            async ({ ctx }) => {
                const lowUser = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "low-user-role",
                    position: 3,
                    permissions: [],
                });
                await assignUserRole(ctx, lowUser.id, "low-user-role");

                const highRole = await createTestingRole(ctx, {
                    name: "high-position",
                    position: 10,
                    permissions: [],
                });

                await expect(
                    reorderRole(ctx, lowUser.id, highRole.id, 5),
                ).rejects.toThrow(
                    "Cannot manage this role - insufficient hierarchy",
                );
            },
            500_000,
        );

        integrationTest(
            "reorderRole throws when trying to move role to or above own position",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await createTestingRole(ctx, {
                    name: "admin-ceiling",
                    position: 10,
                    permissions: [],
                });
                await assignUserRole(ctx, admin.id, "admin-ceiling");

                const toMove = await createTestingRole(ctx, {
                    name: "move-too-high",
                    position: 5,
                    permissions: [],
                });

                await expect(
                    reorderRole(ctx, admin.id, toMove.id, 10),
                ).rejects.toThrow("Cannot move role to or above your position");

                await expect(
                    reorderRole(ctx, admin.id, toMove.id, 11),
                ).rejects.toThrow("Cannot move role to or above your position");
            },
            500_000,
        );
    });
});
