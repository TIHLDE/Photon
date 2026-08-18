import {
    MASTER_CLASS_OFFSET,
    isMasterStudySlug,
} from "@photon/auth/academic-year";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";

/**
 * Group types a priority pool may name.
 *
 * Interest groups are deliberately absent — they get in only through the
 * organizer exception below. `PRIVATE` (bøtelag) and `STUDYYEAR` are absent
 * too: the former is nobody's business, and the latter was replaced by the
 * rolling class level, so a pool naming a cohort group would freeze to an
 * intake instead of following it.
 *
 * Compared upper-cased because `group.type` is free-text varchar carrying
 * Lepton's upper-case values, not the `org_group_type` enum.
 */
const SELECTABLE_GROUP_TYPES = new Set([
    "STUDY",
    "COMMITTEE",
    "SUBGROUP",
    "BOARD",
    "TIHLDE",
    "SPORTSTEAM",
]);

const INTEREST_GROUP_TYPE = "INTERESTGROUP";

type PoolInput = { groupSlug: string | null; classYear: number | null };

/**
 * Reject priority pools the payload alone cannot rule out.
 *
 * `refinePriorityPools` in `~/routes/event/schema` has already enforced
 * everything that is pure; this adds the rules that need to know what a group
 * *is*. Every rejection is a 400 — before this existed an unknown slug reached
 * the insert and surfaced as a foreign-key 500.
 *
 * @param organizerGroupSlug The event's organizer, or null when it has none.
 *   An interest group may appear in a pool only when it is the organizer, and
 *   then only alone: an interest group arranging its own event may prioritize
 *   its own members, but not slice them by class level, and no one else may
 *   prioritize them at all.
 */
export async function validatePriorityPools(
    db: NodePgDatabase<DbSchema>,
    pools: PoolInput[] | null | undefined,
    organizerGroupSlug: string | null,
): Promise<void> {
    if (!pools?.length) return;

    const slugs = [
        ...new Set(
            pools
                .map((pool) => pool.groupSlug)
                .filter((slug): slug is string => slug !== null),
        ),
    ];

    const groups = slugs.length
        ? await db
              .select({
                  slug: schema.group.slug,
                  type: schema.group.type,
              })
              .from(schema.group)
              .where(inArray(schema.group.slug, slugs))
        : [];

    const typeBySlug = new Map(
        groups.map((group) => [group.slug, group.type.toUpperCase()]),
    );

    const reject = (message: string): never => {
        throw new HTTPException(400, { message });
    };

    for (const pool of pools) {
        if (pool.groupSlug === null) {
            // There is no bare "4. klasse": only the master reaches those, so
            // the class level is meaningless without the study to go with it.
            if (
                pool.classYear !== null &&
                pool.classYear > MASTER_CLASS_OFFSET
            ) {
                reject(
                    `Class level ${pool.classYear} must be combined with a master study programme`,
                );
            }
            continue;
        }

        const type = typeBySlug.get(pool.groupSlug);

        if (type === undefined) {
            reject(`Group with slug "${pool.groupSlug}" does not exist`);
            continue;
        }

        if (type === INTEREST_GROUP_TYPE) {
            if (pool.groupSlug !== organizerGroupSlug) {
                reject(
                    `Interest group "${pool.groupSlug}" can only be prioritized on its own events`,
                );
            }

            if (pool.classYear !== null) {
                reject(
                    `Interest group "${pool.groupSlug}" cannot be combined with a class level`,
                );
            }

            continue;
        }

        if (!SELECTABLE_GROUP_TYPES.has(type)) {
            reject(
                `Group "${pool.groupSlug}" cannot be used as a priority pool`,
            );
            continue;
        }

        const isMaster = type === "STUDY" && isMasterStudySlug(pool.groupSlug);

        // A master is never offered on its own: it exists in the picker only
        // as "4. klasse" and "5. klasse", because those are the only years it
        // has, and a bare entry would silently mean "both".
        if (isMaster) {
            if (
                pool.classYear === null ||
                pool.classYear <= MASTER_CLASS_OFFSET
            ) {
                reject(
                    `Study programme "${pool.groupSlug}" must be combined with class level 4 or 5`,
                );
            }
            continue;
        }

        if (pool.classYear !== null && type !== "STUDY") {
            reject(
                `Group "${pool.groupSlug}" cannot be combined with a class level`,
            );
        }

        if (pool.classYear !== null && pool.classYear > MASTER_CLASS_OFFSET) {
            reject(
                `Study programme "${pool.groupSlug}" only runs to class level ${MASTER_CLASS_OFFSET}`,
            );
        }
    }
}
