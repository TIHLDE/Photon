import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { eventIdMap, priorityPoolIdMap, batchInsert } from "../mappings";

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

        poolGroupRecords.push({
            priorityPoolId: newPoolId,
            groupSlug: pg.group_id,
        });
    }

    await batchInsert(poolGroupRecords, 500, async (batch) => {
        await db
            .insert(schema.eventPriorityPoolGroup)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(
        `  Inserted ${poolRecords.length} pools, ${poolGroupRecords.length} pool-groups (${skipped} skipped)`,
    );
    console.log("  Phase 8 complete");
}
