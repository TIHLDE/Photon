import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
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

        const eventsExists = await db
            .select()
            .from(schema.event)
            .where(eq(schema.event.categorySlug, category.slug))
            .limit(1);
        if (!eventsExists.length) {
            await db.insert(schema.event).values({
                title: `Test arrangement for ${category.label}`,
                description: `Dette er et testarrangement i kategorien ${category.label}.`,
                location: "Glæzz",
                categorySlug: category.slug,
                start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                end: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
                ),
                slug: `test-arrangement-${category.slug}`,
                enforcesPreviousStrikes: false,
            });
        }
    }
};
