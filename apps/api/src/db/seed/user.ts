import { schema } from "@photon/db";
import type { AppContext } from "~/lib/ctx";

/**
 * Seed user-related tables (allergy, etc.)
 */
export default async ({ db }: AppContext) => {
    const allergies = [
        {
            slug: "gluten",
            label: "Glutenholdig korn",
            description:
                "Hvete, rug, bygg, havre, spelt, kamut/egyptisk hvete eller hybrider av disse",
        },
        {
            slug: "shellfish",
            label: "Skalldyr",
            description: "Skalldyr (for eksempel reker, krabbe, hummer)",
        },
        {
            slug: "molluscs",
            label: "Bløtdyr",
            description: "Bløtdyr (for eksempel muslinger, blekksprut, østers)",
        },
        {
            slug: "eggs",
            label: "Egg",
        },
        {
            slug: "fish",
            label: "Fisk",
        },
        {
            slug: "peanuts",
            label: "Peanøtter",
        },
        {
            slug: "soy",
            label: "Soya",
        },
        {
            slug: "milk",
            label: "Melk",
            description: "Melk (herunder laktose)",
        },
        {
            slug: "nuts",
            label: "Nøtter",
            description:
                "Nøtter (mandel, hasselnøtt, valnøtt, cashewnøtt, pekannøtt, paranøtt, pistasjnøtt, macadamianøtt/australianøtt)",
        },
        {
            slug: "celery",
            label: "Selleri",
        },
        {
            slug: "mustard",
            label: "Sennep",
        },
        {
            slug: "sesame",
            label: "Sesamfrø",
        },
        {
            slug: "sulfites",
            label: "Svoveldioksid og sulfitt",
        },
        {
            slug: "lupin",
            label: "Lupin",
        },
        {
            slug: "vegetarian",
            label: "Vegetar",
            description: "Vegetarisk kostholdspreferanse",
        },
        {
            slug: "vegan",
            label: "Vegan",
            description: "Vegansk kostholdspreferanse",
        },
        {
            slug: "halal",
            label: "Halal",
            description: "Halal kostholdskrav",
        },
        {
            slug: "kosher",
            label: "Kosher",
            description: "Kosher kostholdskrav",
        },
        {
            slug: "other",
            label: "Annet",
            description: "Andre kostholdsrestriksjoner eller allergier",
        },
    ];

    // Upsert framfor «hopp over hvis den finnes»: radene her fantes allerede
    // før `curated` ble innført, så en ren insert ville aldri fått flagget satt
    // på et miljø som er seedet tidligere — og da ville nedtrekkslista i
    // innstillingene stått tom.
    for (const allergy of allergies) {
        const values = {
            label: allergy.label,
            description: allergy.description ?? null,
            curated: true,
        };

        await db
            .insert(schema.allergy)
            .values({ slug: allergy.slug, ...values })
            .onConflictDoUpdate({ target: schema.allergy.slug, set: values });
    }
};
