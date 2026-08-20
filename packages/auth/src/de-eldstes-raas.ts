import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import {
    group,
    groupMembership,
    groupMembershipHistory,
} from "@photon/db/schema";

/**
 * The private group every former member of Hovedstyret belongs to.
 *
 * A veterans' group: what earns a seat is having sat in HS at some point, not
 * what the member studies now or whether they still study at all. So nothing
 * here reads Feide, enrolment or cohort — an alumnus who graduated in 2014 has
 * exactly the same claim as one who stepped down in May.
 */
export const DE_ELDSTES_RAAS_SLUG = "de-eldstes-raas";

/** Hovedstyret, whose ended memberships are what admits people above. */
const HS_GROUP_SLUG = "hs";

/**
 * Enrol a member in De Eldstes Raas if they have ever sat in Hovedstyret.
 *
 * Runs on every login rather than only on a Feide one, because the group's
 * whole point is the people who have moved on: an alumnus signs in with a
 * password, and the last Feide token they had expired years ago. The question
 * being asked is answered entirely from our own tables anyway.
 *
 * "Tidligere medlem" is read literally, as an *ended* stint —
 * `group_membership_history` for `hs`. A sitting HS member is not yet a former
 * one; they are enrolled by the first login after they step down, since leaving
 * a group is exactly what appends that row (see `removeUserFromGroup`).
 *
 * Enrolment happens once, not on every login. A member who has been taken out
 * of the group by hand has a stint of their own here, and that stint is what
 * keeps them out: without it the removal would last until their next sign-in
 * and nobody could ever remove anyone.
 */
export async function syncDeEldstesRaas(
    db: NodePgDatabase<DbSchema>,
    userId: string,
): Promise<void> {
    /**
     * Both questions in one indexed lookup, and deliberately the first thing
     * asked: almost nobody logging in has ever sat in HS, and for all of them
     * this single query on `(user_id)` is the entire cost of the feature.
     */
    const stints = await db
        .select({ groupSlug: groupMembershipHistory.groupSlug })
        .from(groupMembershipHistory)
        .where(
            and(
                eq(groupMembershipHistory.userId, userId),
                inArray(groupMembershipHistory.groupSlug, [
                    HS_GROUP_SLUG,
                    DE_ELDSTES_RAAS_SLUG,
                ]),
            ),
        );

    const slugs = new Set(stints.map((stint) => stint.groupSlug));

    if (!slugs.has(HS_GROUP_SLUG)) return;
    if (slugs.has(DE_ELDSTES_RAAS_SLUG)) return;

    /**
     * The group is created by a migration, so production and every test
     * database have it. A `db:push`-ed development database that predates the
     * seed may not, and a missing group must read as "nothing to do" rather
     * than a foreign key violation thrown out of somebody's login.
     */
    const [target] = await db
        .select({ slug: group.slug })
        .from(group)
        .where(eq(group.slug, DE_ELDSTES_RAAS_SLUG))
        .limit(1);

    if (!target) return;

    await db
        .insert(groupMembership)
        .values({
            userId,
            groupSlug: DE_ELDSTES_RAAS_SLUG,
            role: "member",
        })
        .onConflictDoNothing();
}
