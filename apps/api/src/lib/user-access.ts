import { clearSessionCopiesAndOAuthGrants } from "@photon/auth";
import { hasPermission } from "@photon/auth/rbac";
import { getUserHighestRolePosition } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { and, eq, notInArray } from "drizzle-orm";
import type { AppContext } from "./ctx";
import { HTTPAppException } from "./errors";

export async function revokeUserAccess(
    ctx: Pick<AppContext, "db" | "auth" | "cache">,
    userId: string,
): Promise<void> {
    await clearSessionCopiesAndOAuthGrants(ctx, userId);

    const { internalAdapter } = await ctx.auth.$context;
    await internalAdapter.deleteUserSessions(userId);
}

/**
 * `member` sits above `alumni` only by seed order. Counting them would stop an
 * admin who has finished their degree from acting on an active student.
 */
const BASELINE_ROLES = ["member", "alumni"];

/**
 * Refuses to let `actorId` deactivate or delete someone above them: root, or the
 * holder of a role placed higher than any of theirs. Most admin rights come from
 * group memberships, which carry no rank, so those holders count as peers.
 */
export async function assertNotAboveActor(
    ctx: Pick<AppContext, "db">,
    actorId: string,
    targetId: string,
): Promise<void> {
    if (await hasPermission(ctx, actorId, "root")) return;

    const refuse = () =>
        HTTPAppException.Forbidden(
            "You cannot do this to a user ranked above you",
        );

    if (await hasPermission(ctx, targetId, "root")) throw refuse();

    const targetRoles = await ctx.db
        .select({ position: schema.role.position })
        .from(schema.userRole)
        .innerJoin(schema.role, eq(schema.userRole.roleId, schema.role.id))
        .where(
            and(
                eq(schema.userRole.userId, targetId),
                notInArray(schema.role.name, BASELINE_ROLES),
            ),
        );
    if (targetRoles.length === 0) return;

    const actorPosition = await getUserHighestRolePosition(ctx, actorId);
    const targetPosition = Math.max(...targetRoles.map((r) => r.position));
    if (targetPosition > (actorPosition ?? 0)) throw refuse();
}
