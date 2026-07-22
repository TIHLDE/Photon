import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    eventIdMap,
    priorityPoolIdMap,
    batchInsert,
    resolveGroupSlug,
} from "../mappings";

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
    let adopted = 0;

    const poolRecords: Array<{
        id: string;
        eventId: string;
        priorityScore: number;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    let skipped = 0;
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

        const newId = crypto.randomUUID();
        priorityPoolIdMap.set(p.id, newId);

        poolRecords.push({
            id: newId,
            eventId: newEventId,
            priorityScore: 1,
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

    // Pool groups
    const poolGroups = await query<LeptonPriorityPoolGroup>(
        "SELECT * FROM content_prioritypool_groups",
    );

    const poolGroupRecords: Array<{
        priorityPoolId: string;
        groupSlug: string;
    }> = [];

    for (const pg of poolGroups) {
        const newPoolId = priorityPoolIdMap.get(pg.prioritypool_id);
        if (!newPoolId) continue;

        // Registration priority is what these pools decide, so a pool pointing
        // at a group Photon dropped must follow that group's replacement
        // rather than quietly disappear.
        const groupSlug = resolveGroupSlug(pg.group_id);
        if (!groupSlug) continue;

        poolGroupRecords.push({
            priorityPoolId: newPoolId,
            groupSlug,
        });
    }

    await batchInsert(poolGroupRecords, 500, async (batch) => {
        await db
            .insert(schema.eventPriorityPoolGroup)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(
        `  Inserted ${poolRecords.length} pools, ${poolGroupRecords.length} pool-groups, ${adopted} already present (${skipped} skipped)`,
    );
    console.log("  Phase 8 complete");
}
