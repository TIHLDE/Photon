import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import {
    group,
    groupMembership,
    groupMembershipHistory,
} from "@photon/db/schema";

/**
 * De Eldstes Raad: the private group for those who have carried one of
 * TIHLDE's positions of trust.
 *
 * Three ways in, and nothing here asks what anyone studies or whether they
 * still do — the whole point is the people who have moved on:
 *
 * 1. Hovedstyret, sitting or former. A seat in HS earns a seat here at once,
 *    and keeps it afterwards.
 * 2. The leader of Forvaltningsgruppen — the fondsforvalter — likewise from
 *    the moment they take over.
 * 3. Ridderne, who are added by hand. TIHLDE records knighthoods nowhere, so
 *    there is nothing for code to read; see the removal rule below for why
 *    hand-picked members are safe here.
 */
export const DE_ELDSTES_RAAD_SLUG = "de-eldstes-raad";

/** Hovedstyret. Any membership qualifies, whatever the role. */
const HS_GROUP_SLUG = "hs";

/**
 * Forvaltningsgruppen, whose leader holds the title Fondsforvalter.
 *
 * Only the leadership qualifies, not the group at large: the seat belongs to
 * the position, and the group has five other members who do not hold it.
 */
const FORVALTNING_GROUP_SLUG = "forvaltningsgruppen";

/**
 * Enrol a member in De Eldstes Raad if any of the three claims applies.
 *
 * Called from two places, and it has to be both. The group memberships that
 * qualify someone are written by admins, so the enrolment happens the moment
 * the seat is granted (see `addUserToGroup`). Login is the safety net for
 * everything the admin path never saw: memberships migrated from Lepton,
 * stints that ended before this code existed, and rows written straight to the
 * database.
 *
 * Enrolment happens once, not on every login. A member taken out of the group
 * by hand has a stint of their own here, and that stint is what keeps them out
 * — without it the removal would last until their next sign-in and nobody
 * could ever remove anyone. This is also what makes the knights safe: they are
 * added by hand, and nothing in here ever removes anybody.
 */
export async function syncDeEldstesRaad(
    db: NodePgDatabase<DbSchema>,
    userId: string,
): Promise<void> {
    /**
     * Both tables, because a claim is equally good whether the seat is held
     * now or was held once. Two indexed lookups on the user, and for almost
     * everyone signing in they come back empty and that is the whole cost.
     */
    const [current, past] = await Promise.all([
        db
            .select({
                groupSlug: groupMembership.groupSlug,
                role: groupMembership.role,
            })
            .from(groupMembership)
            .where(
                and(
                    eq(groupMembership.userId, userId),
                    inArray(groupMembership.groupSlug, [
                        HS_GROUP_SLUG,
                        FORVALTNING_GROUP_SLUG,
                    ]),
                ),
            ),
        db
            .select({
                groupSlug: groupMembershipHistory.groupSlug,
                role: groupMembershipHistory.role,
            })
            .from(groupMembershipHistory)
            .where(
                and(
                    eq(groupMembershipHistory.userId, userId),
                    inArray(groupMembershipHistory.groupSlug, [
                        HS_GROUP_SLUG,
                        FORVALTNING_GROUP_SLUG,
                        DE_ELDSTES_RAAD_SLUG,
                    ]),
                ),
            ),
    ]);

    // Taken out by hand once, and that decision stands.
    if (past.some((stint) => stint.groupSlug === DE_ELDSTES_RAAD_SLUG)) return;

    const seats = [...current, ...past];

    const qualifies = seats.some(
        (seat) =>
            seat.groupSlug === HS_GROUP_SLUG ||
            (seat.groupSlug === FORVALTNING_GROUP_SLUG &&
                seat.role === "leader"),
    );

    if (!qualifies) return;

    /**
     * The group is created by a migration, so production and every test
     * database have it. A `db:push`-ed development database that predates the
     * seed may not, and a missing group must read as "nothing to do" rather
     * than a foreign key violation thrown out of somebody's login.
     */
    const [target] = await db
        .select({ slug: group.slug })
        .from(group)
        .where(eq(group.slug, DE_ELDSTES_RAAD_SLUG))
        .limit(1);

    if (!target) return;

    await db
        .insert(groupMembership)
        .values({
            userId,
            groupSlug: DE_ELDSTES_RAAD_SLUG,
            role: "member",
        })
        .onConflictDoNothing();
}
