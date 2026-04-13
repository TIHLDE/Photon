import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { userIdMap, eventIdMap, batchInsert } from "../mappings";

interface LeptonFavorite {
    event_id: number;
    user_id: string;
}

export async function migrateFavorites(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 9: Event Favorites ===");

    const favorites = await query<LeptonFavorite>(
        "SELECT * FROM content_event_favorite_users",
    );
    console.log(`  Found ${favorites.length} favorites`);

    const records: Array<{ eventId: string; userId: string }> = [];

    let skipped = 0;
    for (const f of favorites) {
        const newEventId = eventIdMap.get(f.event_id);
        const newUserId = userIdMap.get(f.user_id);
        if (!newEventId || !newUserId) {
            skipped++;
            continue;
        }
        records.push({ eventId: newEventId, userId: newUserId });
    }

    await batchInsert(records, 500, async (batch) => {
        await db
            .insert(schema.eventFavorite)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(`  Inserted ${records.length} favorites (${skipped} skipped)`);
    console.log("  Phase 9 complete");
}
