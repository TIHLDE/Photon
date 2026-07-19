import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import {
    userIdMap,
    eventIdMap,
    categoryIdMap,
    slugify,
    timeToMinutes,
    batchInsert,
} from "../mappings";

interface LeptonEvent {
    id: number;
    title: string;
    description: string;
    start_date: Date;
    end_date: Date;
    location: string | null;
    image: string | null;
    category_id: number | null;
    sign_up: number;
    limit: number;
    closed: number;
    start_registration_at: Date | null;
    end_registration_at: Date | null;
    sign_off_deadline: Date | null;
    can_cause_strikes: number;
    enforces_previous_strikes: number;
    organizer_id: string | null;
    contact_person_id: string | null;
    emojis_allowed: number;
    created_at: Date;
    updated_at: Date;
    // from payment_paidevent
    price: string | null; // decimal comes as string from mysql
    paytime: string | null; // TIME field
}

export async function migrateEvents(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 4: Events ===");

    const events = await query<LeptonEvent>(`
        SELECT ce.*, pe.price, pe.paytime
        FROM content_event ce
        LEFT JOIN payment_paidevent pe ON pe.event_id = ce.id
        ORDER BY ce.id ASC
    `);

    console.log(`  Found ${events.length} events`);

    const usedSlugs = new Set<string>();
    const eventRecords: Array<Record<string, unknown>> = [];

    for (const e of events) {
        const newId = crypto.randomUUID();
        eventIdMap.set(e.id, newId);

        let slug = slugify(e.title);
        if (!slug) slug = "event";
        slug = `${slug}-${e.id}`;
        if (usedSlugs.has(slug)) slug = `${slug}-${Date.now()}`;
        usedSlugs.add(slug);

        const categorySlug = e.category_id
            ? (categoryIdMap.get(e.category_id) ?? "uncategorized")
            : "uncategorized";

        const isPaidEvent = e.price != null;
        const priceMinor = isPaidEvent
            ? Math.round(Number(e.price) * 100)
            : null;
        const paymentGracePeriodMinutes = isPaidEvent
            ? timeToMinutes(e.paytime)
            : null;

        eventRecords.push({
            id: newId,
            title: e.title.slice(0, 256),
            slug: slug.slice(0, 256),
            description: e.description || null,
            categorySlug,
            location: e.location?.slice(0, 256) ?? null,
            imageUrl: e.image ?? null,
            capacity: e.limit > 0 ? e.limit : null,
            allowWaitlist: true,
            contactPersonId: e.contact_person_id
                ? (userIdMap.get(e.contact_person_id) ?? null)
                : null,
            createdByUserId: e.contact_person_id
                ? (userIdMap.get(e.contact_person_id) ?? null)
                : null,
            start: e.start_date,
            end: e.end_date,
            registrationStart: e.start_registration_at,
            registrationEnd: e.end_registration_at,
            cancellationDeadline: e.sign_off_deadline,
            isRegistrationClosed: Boolean(e.closed),
            isPaidEvent,
            requiresSigningUp: Boolean(e.sign_up),
            priceMinor,
            paymentGracePeriodMinutes,
            reactionsAllowed: Boolean(e.emojis_allowed),
            organizerGroupSlug: e.organizer_id ?? null,
            enforcesPreviousStrikes: Boolean(e.enforces_previous_strikes),
            createdAt: e.created_at,
            updatedAt: e.updated_at,
        });
    }

    await batchInsert(eventRecords, 500, async (batch) => {
        await db
            .insert(schema.event)
            .values(batch as any)
            .onConflictDoNothing();
    });

    console.log(`  Inserted ${eventRecords.length} events`);
    console.log("  Phase 4 complete");
}
