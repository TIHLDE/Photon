import { hasPermission } from "@photon/auth/rbac";
import { isGroupLeader } from "~/lib/group";
import type { AppContext } from "~/lib/ctx";

type GroupRow = { slug: string; finesAdminId: string | null };

/**
 * Whether a user can create/update/delete laws for a group.
 *
 * Lepton parity, minus the permission: the fines admin (botsjef) or a group
 * leader writes the lovverk, and root can reach any group's. Bøter are not
 * part of the permission system, so there is no `fines:manage` to hold.
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

    return await hasPermission(ctx, userId, "root");
}
