import type { Permission } from "@photon/auth/rbac";
import { assignUserRole, createTestingRole } from "@photon/auth/roles";
import type { UserWithRole } from "better-auth/plugins";
import type { TestUtilContext } from ".";

export const createGiveUserPermissions =
    (ctx: TestUtilContext) =>
    async (
        user: UserWithRole & { password: string },
        permissions: Permission[],
    ) => {
        const role = await createTestingRole(ctx, {
            name: `test-role-${crypto.randomUUID()}`,
            permissions: permissions,
            description: "Role created for testing purposes",
            position: 1,
        });

        await assignUserRole(ctx, user.id, role.name);
    };
