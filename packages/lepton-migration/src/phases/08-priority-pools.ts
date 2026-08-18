import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { eventIdMap, batchInsert, resolveGroupSlug } from "../mappings";

interface LeptonPriorityPool {
    id: number;
    event_id: number;
    created_at: Date;
    updated_at: Date;
}

interface LeptonPriorityPoolGroup {
    prioritypool_id: number;
    group_id: string;
}

/**
 * Which class level a cohort meant on the day of the event.
 *
 * Anchored on the event's own start date, not on the day the import runs:
 * "2023-kullet" on an event held in autumn 2024 meant 2. klasse then, and a
 * historical pool should keep saying what it said. The Norwegian academic year
 * turns over in August, which is what the month test is for.
 *
 * Mirrors the backfill in `packages/db/drizzle/0063_slim_eternity.sql` — change
 * the two together.
 */
function classYearAt(startYear: number, eventStart: Date): number {
    return (
        eventStart.getFullYear() -
        startYear +
        (eventStart.getMonth() >= 7 ? 1 : 0)
    );
}

export async function migratePriorityPools(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 8: Priority Pools ===");

    const pools = await query<LeptonPriorityPool>(
        "SELECT * FROM content_prioritypool",
    );
    console.log(`  Found ${pools.length} priority pools`);

    /**
     * Pools mint a random uuid per row, so a re-run (the delta import) would
     * duplicate them. A pool has no natural key of its own — skip every pool
     * whose EVENT already has pools in Photon: historical pools do not
     * change, and new pools arrive on new events. (An old event gaining an
     * additional pool in Lepton after the initial import is the one case
     * this misses — it would have to be carried over by hand.)
     */
    const existingPools = await db
        .select({ eventId: schema.eventPriorityPool.eventId })
        .from(schema.eventPriorityPool);
    const eventsWithPools = new Set(existingPools.map((p) => p.eventId));

    /**
     * Lepton has no notion of Photon's group types, and the split between a
     * cohort and a real group is exactly what decides which column a pool row
     * lands in — so read the types from Photon, once.
     */
    const groups = await db
        .select({ slug: schema.group.slug, type: schema.group.type })
        .from(schema.group);
    const cohortSlugs = new Set(
        groups
            .filter((g) => g.type.toUpperCase() === "STUDYYEAR")
            .map((g) => g.slug),
    );

    const eventStarts = new Map(
        (
            await db
                .select({ id: schema.event.id, start: schema.event.start })
                .from(schema.event)
        ).map((e) => [e.id, e.start]),
    );

    const poolGroups = await query<LeptonPriorityPoolGroup>(
        "SELECT * FROM content_prioritypool_groups",
    );

    const slugsByPool = new Map<number, string[]>();
    for (const pg of poolGroups) {
        // Registration priority is what these pools decide, so a pool pointing
        // at a group Photon dropped must follow that group's replacement
        // rather than quietly disappear.
        const groupSlug = resolveGroupSlug(pg.group_id);
        if (!groupSlug) continue;

        const slugs = slugsByPool.get(pg.prioritypool_id) ?? [];
        slugs.push(groupSlug);
        slugsByPool.set(pg.prioritypool_id, slugs);
    }

    const poolRecords: Array<{
        eventId: string;
        groupSlug: string | null;
        classYear: number | null;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    let adopted = 0;
    let skipped = 0;
    let empty = 0;
    let narrowed = 0;

    for (const p of pools) {
        const newEventId = eventIdMap.get(p.event_id);
        if (!newEventId) {
            skipped++;
            continue;
        }

        if (eventsWithPools.has(newEventId)) {
            adopted++;
            continue;
        }

        const slugs = slugsByPool.get(p.id) ?? [];
        const cohorts = slugs.filter((slug) => cohortSlugs.has(slug));
        const others = slugs.filter((slug) => !cohortSlugs.has(slug));

        // A pool could name any number of groups in Lepton; the new shape
        // holds one. Lexicographically smallest is arbitrary but stable, and
        // the discarded ones stay in `event_priority_pool_group`, which is
        // kept as an archive for exactly this reason.
        if (others.length > 1 || cohorts.length > 1) narrowed++;

        const eventStart = eventStarts.get(newEventId);
        const cohortYear = cohorts.length
            ? Number.parseInt(cohorts.sort()[0] as string, 10)
            : null;

        let classYear: number | null = null;
        if (cohortYear !== null && eventStart) {
            const computed = classYearAt(cohortYear, eventStart);
            if (computed >= 1 && computed <= 5) classYear = computed;
        }

        const groupSlug = others.length ? (others.sort()[0] as string) : null;

        // A pool expressing nothing matched nobody before and would violate
        // the CHECK constraint now, so it is dropped rather than carried over.
        if (groupSlug === null && classYear === null) {
            empty++;
            continue;
        }

        poolRecords.push({
            eventId: newEventId,
            groupSlug,
            classYear,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
        });
    }

    await batchInsert(poolRecords, 500, async (batch) => {
        await db
            .insert(schema.eventPriorityPool)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(
        `  Inserted ${poolRecords.length} pools, ${adopted} already present (${skipped} skipped, ${empty} expressed nothing, ${narrowed} narrowed to one group)`,
    );
    console.log("  Phase 8 complete");
}
