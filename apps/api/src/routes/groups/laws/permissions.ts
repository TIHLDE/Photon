import { hasPermission, hasScopedPermission } from "@photon/auth/rbac";
import { isGroupLeader } from "~/lib/group";
import type { AppContext } from "~/lib/ctx";

type GroupRow = { slug: string; finesAdminId: string | null };

/**
 * Whether a user can create/update/delete laws for a group.
 *
 * Lepton parity: the fines admin (botsjef), a group leader, or an admin
 * ('fines:manage' globally or scoped to the group) can manage the lovverk.
 */
export async function canManageLaws(
    ctx: AppContext,
    userId: string,
    group: GroupRow,
): Promise<boolean> {
    if (group.finesAdminId === userId) {
        return true;
    }

    if (await isGroupLeader(ctx, userId, group.slug)) {
        return true;
    }

    if (await hasPermission(ctx, userId, ["root", "fines:manage"])) {
        return true;
    }

    return await hasScopedPermission(
        ctx,
        userId,
        "fines:manage",
        `group:${group.slug}`,
    );
}
