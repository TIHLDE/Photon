import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { schema } from "@photon/db";
import { query } from "../mysql";
import { categoryIdMap, slugify } from "../mappings";

interface LeptonCategory {
    id: number;
    text: string | null;
}

export async function migrateCategories(
    db: NodePgDatabase<DbSchema>,
): Promise<void> {
    console.log("\n=== Phase 3: Event Categories ===");

    const categories = await query<LeptonCategory>(
        "SELECT * FROM content_category",
    );
    console.log(`  Found ${categories.length} categories`);

    // Create "uncategorized" fallback
    await db
        .insert(schema.eventCategory)
        .values({ slug: "uncategorized", label: "Uncategorized" })
        .onConflictDoNothing();

    const usedSlugs = new Set<string>(["uncategorized"]);

    for (const cat of categories) {
        const label = cat.text?.trim() || `Category ${cat.id}`;
        let slug = slugify(label).slice(0, 60);

        // Handle slug collision
        if (usedSlugs.has(slug)) {
            slug = `${slug}-${cat.id}`;
        }
        usedSlugs.add(slug);

        categoryIdMap.set(cat.id, slug);

        await db
            .insert(schema.eventCategory)
            .values({ slug, label: label.slice(0, 128) })
            .onConflictDoNothing();
    }

    console.log(
        `  Inserted ${categories.length + 1} categories (including uncategorized)`,
    );
    console.log("  Phase 3 complete");
}
