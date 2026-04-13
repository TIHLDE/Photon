import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { userIdMap, eventIdMap, char32ToUuid, batchInsert } from "../mappings";

interface LeptonStrike {
    id: string;
    event_id: number | null;
    user_id: string;
    strike_size: number;
    description: string;
    created_at: Date;
    updated_at: Date;
}

export async function migrateStrikes(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 6: Event Strikes ===");

    const strikes = await query<LeptonStrike>("SELECT * FROM content_strike");
    console.log(`  Found ${strikes.length} strikes`);

    const records: Array<{
        id: string;
        eventId: string;
        userId: string;
        count: number;
        reason: string | null;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    let skipped = 0;
    for (const s of strikes) {
        if (!s.event_id) {
            skipped++;
            continue;
        }
        const newEventId = eventIdMap.get(s.event_id);
        const newUserId = userIdMap.get(s.user_id);
        if (!newEventId || !newUserId) {
            skipped++;
            continue;
        }

        records.push({
            id: char32ToUuid(s.id),
            eventId: newEventId,
            userId: newUserId,
            count: s.strike_size,
            reason: s.description?.slice(0, 256) || null,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
        });
    }

    await batchInsert(records, 500, async (batch) => {
        await db.insert(schema.eventStrike).values(batch).onConflictDoNothing();
    });

    console.log(`  Inserted ${records.length} strikes (${skipped} skipped)`);
    console.log("  Phase 6 complete");
}
