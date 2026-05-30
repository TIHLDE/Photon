import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { getUserPermissions } from "../rbac/permissions";

type DbCtx = { db: NodePgDatabase<DbSchema> };

/**
 * Loads the permissions and group memberships for a user.
 *
 * Used by:
 * - the customSession hook to enrich the session response
 * - the OIDC ID-token / UserInfo claim hooks to expose roles to third-party apps
 *
 * The return type is intentionally inlined so `tsc --typeToString` (used by
 * the SDK's session-types generator) doesn't emit a cross-package import.
 */
export async function loadUserRolesAndGroups(
    ctx: DbCtx,
    userId: string,
): Promise<{
    permissions: string[];
    groups: Array<{ slug: string; name: string; type: string; role: string }>;
}> {
    const [permissions, groups] = await Promise.all([
        getUserPermissions(ctx, userId),
        ctx.db.query.groupMembership.findMany({
            where: (gm, { eq }) => eq(gm.userId, userId),
            with: { group: true },
        }),
    ]);

    return {
        permissions: [...new Set(permissions)],
        groups: groups.map((g) => ({
            slug: g.groupSlug,
            name: g.group.name,
            type: g.group.type,
            role: g.role,
        })),
    };
}
