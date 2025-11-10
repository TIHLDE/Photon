import { eq } from "drizzle-orm";
import { schema } from "..";
import type { AppContext } from "../../lib/ctx";

/**
 * Seed event-related tables (event, eventCategory, eventRegistration, etc.)
 */
export default async ({ db }: AppContext) => {
    const eventCategories = [
        { label: "Kurs", slug: "kurs" },
        { label: "Annet", slug: "annet" },
        { label: "Fadderuka", slug: "fadderuka" },
        { label: "Bedpres", slug: "bedpres" },
        { label: "Sosialt", slug: "sosialt" },
        { label: "Aktivitet", slug: "aktivitet" },
    ] as const;

    for (const category of eventCategories) {
        const exists = await db
            .select()
            .from(schema.eventCategory)
            .where(eq(schema.eventCategory.slug, category.slug))
            .limit(1);

        if (!exists.length) {
            await db.insert(schema.eventCategory).values({
                label: category.label,
                slug: category.slug,
            });
        }
    }
};
