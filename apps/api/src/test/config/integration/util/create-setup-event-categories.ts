import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { TestUtilContext } from ".";

export const createSetupEventCategories =
    (ctx: TestUtilContext) => async () => {
        const eventCategories = [
            { label: "Kurs", slug: "kurs" },
            { label: "Annet", slug: "annet" },
            { label: "Fadderuka", slug: "fadderuka" },
            { label: "Bedpres", slug: "bedpres" },
            { label: "Sosialt", slug: "sosialt" },
            { label: "Aktivitet", slug: "aktivitet" },
        ] as const;

        for (const category of eventCategories) {
            const exists = await ctx.db
                .select()
                .from(schema.eventCategory)
                .where(eq(schema.eventCategory.slug, category.slug))
                .limit(1);

            if (!exists.length) {
                await ctx.db.insert(schema.eventCategory).values({
                    label: category.label,
                    slug: category.slug,
                });
            }
        }
    };
