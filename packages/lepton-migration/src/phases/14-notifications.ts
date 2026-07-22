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

    /**
     * Notifications have no natural key and mint a random uuid per row, so a
     * re-run (the delta import) would duplicate the entire archive. Skip rows
     * that already exist by (userId, createdAt) — Lepton timestamps are
     * microsecond-precision, so one user does not get two notifications in
     * the same microsecond.
     */
    const existing = await db
        .select({
            userId: schema.notification.userId,
            createdAt: schema.notification.createdAt,
        })
        .from(schema.notification);
    const existingKeys = new Set(
        existing.map((n) => `${n.userId} ${n.createdAt.getTime()}`),
    );
    let adopted = 0;

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

        if (existingKeys.has(`${newUserId} ${n.created_at.getTime()}`)) {
            adopted++;
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

    console.log(
        `  Inserted ${records.length} notifications, ${adopted} already present (${skipped} skipped)`,
    );
    console.log("  Phase 14 complete");
}
