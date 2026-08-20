import { schema } from "@photon/db";
import type { AppContext } from "~/lib/ctx";

/**
 * Seed user-related tables (allergy, etc.)
 */
export default async ({ db }: AppContext) => {
    // Allergenene er Mattilsynets 14, med deres egne eksempler:
    // https://www.mattilsynet.no/mat-og-drikke/merking-av-mat/slik-skal-allergenene-merkes/de-14-allergenene
    //
    // Etikettene er kortet ned der Mattilsynets overskrift er for lang til
    // en chip («Kornslag som inneholder gluten»), mens beskrivelsen bærer
    // ordlyden deres. Det er eksemplene som gjør at folk kjenner igjen sitt
    // eget — de færreste vet at worcestersaus inneholder fisk.
    const allergies = [
        {
            slug: "gluten",
            label: "Glutenholdig korn",
            description:
                "Hvete, rug, bygg, havre, spelt, korasanhvete og lignende",
        },
        {
            slug: "shellfish",
            label: "Skalldyr",
            description: "Krabbe, hummer, reker, krill, kreps og scampi",
        },
        {
            slug: "eggs",
            label: "Egg",
            description: "Egg og produkter framstilt av egg",
        },
        {
            slug: "fish",
            label: "Fisk",
            description:
                "Også skjult i for eksempel leverpostei og worcestersaus",
        },
        {
            slug: "peanuts",
            label: "Peanøtter",
            description:
                "Også i kjeks, kaker, desserter, sjokolade, iskrem, peanøttolje og peanøttsmør",
        },
        {
            slug: "soy",
            label: "Soya",
            description: "Tofu, miso, tempeh, soyasaus, soyadrikker og soyamel",
        },
        {
            slug: "milk",
            label: "Melk",
            description:
                "Smør, ost, fløte, iskrem, desserter, melkepulver og yoghurt. Herunder laktose",
        },
        {
            slug: "nuts",
            label: "Nøtter",
            description:
                "Mandler, hasselnøtter, valnøtter, kasjunøtter, pekannøtter, pistasienøtter, paranøtter og macadamianøtter",
        },
        {
            slug: "celery",
            label: "Selleri",
            description: "Stangselleri, i tillegg til blader, frø og rot",
        },
        {
            slug: "mustard",
            label: "Sennep",
            description: "Sennep, sennepspulver og sennepsfrø",
        },
        {
            slug: "sesame",
            label: "Sesamfrø",
            description:
                "Også i brød, knekkebrød, kjeks, hummus, vegetarretter og godteri",
        },
        {
            slug: "sulfites",
            label: "Svoveldioksid og sulfitter",
            description: "Brukes til konservering av frukt og grønnsaker",
        },
        {
            slug: "lupin",
            label: "Lupin",
            description: "Lupinfrø og lupinmel",
        },
        {
            slug: "molluscs",
            label: "Bløtdyr",
            description:
                "Muslinger, snegler, blekksprut, blåskjell, kamskjell, østers og hjerteskjell",
        },

        // Ikke allergener, men kostholdskrav kjøkkenet må planlegge for.
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
