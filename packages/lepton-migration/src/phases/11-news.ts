import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { userIdMap, newsIdMap, batchInsert } from "../mappings";

interface LeptonNews {
    id: number;
    title: string;
    header: string;
    body: string;
    image: string | null;
    image_alt: string | null;
    creator_id: string | null;
    emojis_allowed: number;
    created_at: Date;
    updated_at: Date;
}

export async function migrateNews(db: NodePgDatabase<DbSchema>): Promise<void> {
    console.log("\n=== Phase 11: News ===");

    const news = await query<LeptonNews>("SELECT * FROM content_news");
    console.log(`  Found ${news.length} news articles`);

    /**
     * Articles can already exist: import-news-jobs.ts loaded the archive from
     * Lepton's public API. The table has no natural key, so inserting again
     * would duplicate every article — and the map must point at the row that
     * exists, or phase 12 hangs reactions on articles that were never
     * written. Adopt by (title, created_at), the same identity the importer
     * dedupes on.
     */
    const existingNews = await db
        .select({
            id: schema.news.id,
            title: schema.news.title,
            createdAt: schema.news.createdAt,
        })
        .from(schema.news);
    const existingByTitleCreated = new Map(
        existingNews.map((n) => [`${n.title} ${n.createdAt.getTime()}`, n.id]),
    );

    let adopted = 0;
    const records = news.flatMap((n) => {
        const existingId = existingByTitleCreated.get(
            `${n.title.slice(0, 200)} ${n.created_at.getTime()}`,
        );
        if (existingId) {
            newsIdMap.set(n.id, existingId);
            adopted++;
            return [];
        }

        const newId = crypto.randomUUID();
        newsIdMap.set(n.id, newId);

        return {
            id: newId,
            title: n.title.slice(0, 200),
            header: n.header.slice(0, 200),
            body: n.body,
            imageUrl: n.image ?? null,
            imageAlt: n.image_alt?.slice(0, 255) ?? null,
            createdById: n.creator_id
                ? (userIdMap.get(n.creator_id) ?? null)
                : null,
            emojisAllowed: Boolean(n.emojis_allowed),
            createdAt: n.created_at,
            updatedAt: n.updated_at,
        };
    });

    await batchInsert(records, 500, async (batch) => {
        await db.insert(schema.news).values(batch).onConflictDoNothing();
    });

    console.log(
        `  Inserted ${records.length} news articles, adopted ${adopted} existing`,
    );
    console.log("  Phase 11 complete");
}
