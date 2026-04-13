import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { userIdMap, batchInsert } from "../mappings";

interface LeptonNotification {
    id: number;
    user_id: string;
    title: string;
    description: string;
    link: string | null;
    read: number;
    created_at: Date;
    updated_at: Date;
}

export async function migrateNotifications(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 14: Notifications ===");

    const notifications = await query<LeptonNotification>(
        "SELECT * FROM communication_notification",
    );
    console.log(`  Found ${notifications.length} notifications`);

    const records: Array<{
        id: string;
        userId: string;
        title: string;
        description: string;
        link: string | null;
        isRead: boolean;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    let skipped = 0;
    for (const n of notifications) {
        const newUserId = userIdMap.get(n.user_id);
        if (!newUserId) {
            skipped++;
            continue;
        }

        records.push({
            id: crypto.randomUUID(),
            userId: newUserId,
            title: n.title,
            description: n.description,
            link: n.link,
            isRead: Boolean(n.read),
            createdAt: n.created_at,
            updatedAt: n.updated_at,
        });
    }

    await batchInsert(records, 500, async (batch) => {
        await db
            .insert(schema.notification)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(`  Inserted ${records.length} notifications (${skipped} skipped)`);
    console.log("  Phase 14 complete");
}
