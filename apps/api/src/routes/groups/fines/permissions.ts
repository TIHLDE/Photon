import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "~/lib/ctx";
import { isDerivedGroupType, isGroupLeader, isGroupMember } from "~/lib/group";
import { hasActiveStudyProgram } from "~/lib/user/study";

type GroupRow = {
    slug: string;
    type: string;
    finesAdminId: string | null;
    finesActivated: boolean;
};

/**
 * Whether a user counts as "in the group" for the purpose of bøter.
 *
 * For every ordinary group this is plain membership — bøter are what being in
 * a group is, and the roster is the roster.
 *
 * Study and cohort groups are the exception, because their rosters are not
 * rosters. They are projections of Feide that only ever grow: leaving a
 * programme never removes the group, so `digital-samhandling` holds 128 people
 * of whom some finished in 2021. Handing all of them the right to give and
 * read bøter among this year's students is not what membership of a study
 * group means. So for those groups membership is necessary but not
 * sufficient — Feide has to still report the person as enrolled.
 *
 * A `study` group is checked against its own programme; the two share a slug.
 * A `studyyear` group has no programme to check against — a cohort spans all
 * of them — so it asks the weaker question, "still a student anywhere", which
 * is the most that group can honestly be gated on.
 */
export async function isFinesEligibleMember(
    ctx: AppContext,
    userId: string,
    group: Pick<GroupRow, "slug" | "type">,
): Promise<boolean> {
    if (!(await isGroupMember(ctx, userId, group.slug))) {
        return false;
    }

    if (!isDerivedGroupType(group.type)) {
        return true;
    }

    const programSlug =
        group.type.toLowerCase() === "study" ? group.slug : null;

    return await hasActiveStudyProgram(ctx, userId, programSlug);
}

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
 * Membership itself is the access — any member sees every fine in their own
 * group. There is no `fines:view` permission to hold: bøter are not part of
 * the permission system, and root is the only way across group lines.
 *
 * "Member" here means {@link isFinesEligibleMember}, so a study group's bøter
 * stay among the students actually enrolled rather than every alumnus the
 * projection ever collected. The botsjef is exempt: they are an appointment,
 * not a projection, and someone has to be able to settle the bøter.
 */
export async function canViewFines(
    ctx: AppContext,
    userId: string,
    group: GroupRow,
): Promise<boolean> {
    if (group.finesAdminId === userId) {
        return true;
    }

    if (await isFinesEligibleMember(ctx, userId, group)) {
        return true;
    }

    return await hasPermission(ctx, userId, "root");
}

/**
 * Whether a user may settle fines — approve, mark paid, reject.
 *
 * Handing one out is something any member does; ruling on it stays with the
 * botsjef and the group's leader. Same rule the single-fine PATCH applies, so
 * batch updates cannot be used to sidestep it.
 */
export async function canUpdateFines(
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
