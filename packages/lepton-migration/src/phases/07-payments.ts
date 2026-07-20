import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    userIdMap,
    eventIdMap,
    char32ToUuid,
    mapPaymentStatus,
    batchInsert,
} from "../mappings";

interface LeptonPaymentOrder {
    order_id: string;
    status: string;
    event_id: number | null;
    user_id: string | null;
    created_at: Date;
    updated_at: Date;
}

interface LeptonPaidEvent {
    event_id: number;
    price: string; // decimal
}

export async function migratePayments(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 7: Payments ===");

    const orders = await query<LeptonPaymentOrder>(
        "SELECT * FROM payment_order",
    );
    const paidEvents = await query<LeptonPaidEvent>(
        "SELECT event_id, price FROM payment_paidevent",
    );
    console.log(`  Found ${orders.length} payment orders`);

    // Build price lookup
    const priceMap = new Map<number, number>();
    for (const pe of paidEvents) {
        priceMap.set(pe.event_id, Math.round(Number(pe.price) * 100));
    }

    const records: Array<{
        id: string;
        eventId: string;
        userId: string;
        amountMinor: number;
        currency: string;
        provider: string;
        status: "pending" | "paid" | "refunded" | "failed";
        receivedPaymentAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }> = [];

    let skipped = 0;
    for (const o of orders) {
        if (!o.event_id || !o.user_id) {
            skipped++;
            continue;
        }
        const newEventId = eventIdMap.get(o.event_id);
        const newUserId = userIdMap.get(o.user_id);
        if (!newEventId || !newUserId) {
            skipped++;
            continue;
        }

        const status = mapPaymentStatus(o.status);
        const amountMinor = priceMap.get(o.event_id) ?? 0;

        records.push({
            id: char32ToUuid(o.order_id),
            eventId: newEventId,
            userId: newUserId,
            amountMinor,
            currency: "NOK",
            provider: "vipps",
            status,
            receivedPaymentAt: status === "paid" ? o.updated_at : null,
            createdAt: o.created_at,
            updatedAt: o.updated_at,
        });
    }

    await batchInsert(records, 500, async (batch) => {
        await db
            .insert(schema.eventPayment)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(`  Inserted ${records.length} payments (${skipped} skipped)`);
    console.log("  Phase 7 complete");
}
