import { hasPermission } from "@photon/auth/rbac";
import { getUserHighestRolePosition } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import type { AppContext } from "./ctx";
import { HTTPAppException } from "./errors";

/**
 * Better Auth reads a session from secondary storage first and only falls back
 * to Postgres, so deleting the row leaves the session working. Its own
 * `deleteUserSessions` finds what to clear through a list kept in that storage,
 * which a restart can lose, so the tokens Postgres knows are cleared by name.
 *
 * OAuth grants go too. Their tokens outlive the session: the foreign key only
 * nulls `session_id`, and the refresh grant then issues a token with no session
 * behind it at all.
 */
export async function revokeUserAccess(
    ctx: Pick<AppContext, "db" | "auth">,
    userId: string,
): Promise<void> {
    const { db, auth } = ctx;
    const { internalAdapter } = await auth.$context;

    const sessions = await db
        .select({ token: schema.session.token })
        .from(schema.session)
        .where(eq(schema.session.userId, userId));

    if (sessions.length > 0) {
        await internalAdapter.deleteSessions(sessions.map((s) => s.token));
    }
    await internalAdapter.deleteUserSessions(userId);

    await db
        .update(schema.oauthRefreshToken)
        .set({ revoked: new Date() })
        .where(
            and(
                eq(schema.oauthRefreshToken.userId, userId),
                isNull(schema.oauthRefreshToken.revoked),
            ),
        );
    await db
        .delete(schema.oauthAccessToken)
        .where(eq(schema.oauthAccessToken.userId, userId));
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
