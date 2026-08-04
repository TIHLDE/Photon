import { hasPermission, hasScopedPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "~/lib/ctx";
import { isGroupMember } from "~/lib/group";

type GroupRow = {
    slug: string;
    finesAdminId: string | null;
    finesActivated: boolean;
};

/**
 * Load the group a fines endpoint addresses, refusing groups that do not run
 * the fine system.
 *
 * Lepton scoped every fine query with `group__fines_activated=True`, so turning
 * the system off hid the group's fines entirely. Photon only enforced it when
 * creating a fine, which meant a group that switched fines off kept serving its
 * old fines to every member.
 *
 * The lovverk endpoints deliberately do NOT use this: a group has to be able to
 * write its paragraphs before switching the system on.
 */
export async function requireFinesGroup(ctx: AppContext, groupSlug: string) {
    const group = await ctx.db
        .select()
        .from(schema.group)
        .where(eq(schema.group.slug, groupSlug))
        .limit(1)
        .then((res) => res[0]);

    if (!group) {
        throw new HTTPException(404, {
            message: `Group with slug "${groupSlug}" not found`,
        });
    }

    if (!group.finesActivated) {
        throw new HTTPException(404, {
            message: `Fines are not activated for group "${groupSlug}"`,
        });
    }

    return group;
}

/**
 * Whether a user may read a group's fines.
 *
 * Lepton parity: membership itself is the access — any member sees every fine
 * in their own group. The botsjef and `fines:view` holders see them too.
 */
export async function canViewFines(
    ctx: AppContext,
    userId: string,
    group: GroupRow,
): Promise<boolean> {
    if (group.finesAdminId === userId) {
        return true;
    }

    if (await isGroupMember(ctx, userId, group.slug)) {
        return true;
    }

    return await hasScopedPermission(
        ctx,
        userId,
        "fines:view",
        `group:${group.slug}`,
    );
}

/**
 * Whether a user may settle fines — approve, mark paid, reject.
 *
 * Same rule the single-fine PATCH applies, so batch updates cannot be used to
 * sidestep it.
 */
export async function canUpdateFines(
    ctx: AppContext,
    userId: string,
    group: GroupRow,
): Promise<boolean> {
    if (group.finesAdminId === userId) {
        return true;
    }

    if (await hasPermission(ctx, userId, "fines:update")) {
        return true;
    }

    return await hasScopedPermission(
        ctx,
        userId,
        "fines:update",
        `group:${group.slug}`,
    );
}
