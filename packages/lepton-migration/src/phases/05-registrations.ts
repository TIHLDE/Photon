import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    userIdMap,
    eventIdMap,
    mapRegistrationStatus,
    batchInsert,
} from "../mappings";

interface LeptonRegistration {
    registration_id: number;
    event_id: number;
    user_id: string;
    is_on_wait: number;
    has_attended: number;
    created_at: Date;
    updated_at: Date;
}

export async function migrateRegistrations(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 5: Event Registrations ===");

    const registrations = await query<LeptonRegistration>(
        "SELECT * FROM content_registration",
    );
    console.log(`  Found ${registrations.length} registrations`);

    const records: Array<{
        eventId: string;
        userId: string;
        status: "registered" | "waitlisted" | "attended";
        attendedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    let skipped = 0;
    for (const r of registrations) {
        const newEventId = eventIdMap.get(r.event_id);
        const newUserId = userIdMap.get(r.user_id);
        if (!newEventId || !newUserId) {
            skipped++;
            continue;
        }

        const status = mapRegistrationStatus(r.has_attended, r.is_on_wait);

        records.push({
            eventId: newEventId,
            userId: newUserId,
            status,
            attendedAt: r.has_attended ? r.updated_at : null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        });
    }

    await batchInsert(records, 500, async (batch) => {
        await db
            .insert(schema.eventRegistration)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(`  Inserted ${records.length} registrations (${skipped} skipped)`);
    console.log("  Phase 5 complete");
}
