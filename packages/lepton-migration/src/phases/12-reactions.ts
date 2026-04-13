import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { userIdMap, eventIdMap, newsIdMap, batchInsert } from "../mappings";

interface DjangoContentType {
    id: number;
    app_label: string;
    model: string;
}

interface LeptonReaction {
    reaction_id: number;
    emoji: string;
    user_id: string;
    object_id: number | null;
    content_type_id: number | null;
}

export async function migrateReactions(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 12: Reactions ===");

    // Resolve content type IDs for event and news
    const contentTypes = await query<DjangoContentType>(
        "SELECT * FROM django_content_type",
    );

    let eventContentTypeId: number | null = null;
    let newsContentTypeId: number | null = null;

    for (const ct of contentTypes) {
        if (ct.app_label === "content" && ct.model === "event") {
            eventContentTypeId = ct.id;
        }
        if (ct.app_label === "content" && ct.model === "news") {
            newsContentTypeId = ct.id;
        }
    }

    console.log(`  Content type IDs - event: ${eventContentTypeId}, news: ${newsContentTypeId}`);

    const reactions = await query<LeptonReaction>(
        "SELECT * FROM emoji_reaction",
    );
    console.log(`  Found ${reactions.length} reactions`);

    const eventReactions: Array<{
        userId: string;
        eventId: string;
        emoji: string;
    }> = [];

    const newsReactions: Array<{
        userId: string;
        newsId: string;
        emoji: string;
    }> = [];

    let skipped = 0;
    for (const r of reactions) {
        if (!r.object_id || !r.content_type_id) {
            skipped++;
            continue;
        }

        const newUserId = userIdMap.get(r.user_id);
        if (!newUserId) {
            skipped++;
            continue;
        }

        const emoji = r.emoji.slice(0, 32);

        if (r.content_type_id === eventContentTypeId) {
            const newEventId = eventIdMap.get(r.object_id);
            if (newEventId) {
                eventReactions.push({
                    userId: newUserId,
                    eventId: newEventId,
                    emoji,
                });
            } else {
                skipped++;
            }
        } else if (r.content_type_id === newsContentTypeId) {
            const newNewsId = newsIdMap.get(r.object_id);
            if (newNewsId) {
                newsReactions.push({
                    userId: newUserId,
                    newsId: newNewsId,
                    emoji,
                });
            } else {
                skipped++;
            }
        } else {
            skipped++;
        }
    }

    await batchInsert(eventReactions, 500, async (batch) => {
        await db
            .insert(schema.eventReaction)
            .values(batch)
            .onConflictDoNothing();
    });

    await batchInsert(newsReactions, 500, async (batch) => {
        await db
            .insert(schema.newsReaction)
            .values(batch)
            .onConflictDoNothing();
    });

    console.log(`  Inserted ${eventReactions.length} event reactions, ${newsReactions.length} news reactions (${skipped} skipped)`);
    console.log("  Phase 12 complete");
}
