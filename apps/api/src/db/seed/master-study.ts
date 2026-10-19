import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { inArray } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

type SeedEntry = Omit<
    typeof schema.masterStudyEntry.$inferInsert,
    "studyProgramId"
> & {
    studyProgramSlug: string;
    quotes: { name: string | null; quote: string }[];
};

/** 23:59 Oslo time on the given day next year (rough DST: April–October). */
function nextDeadline(month: number, day: number) {
    const year = new Date().getUTCFullYear() + 1;
    const utcOffset = month >= 4 && month <= 10 ? 2 : 1;
    return new Date(Date.UTC(year, month - 1, day, 23 - utcOffset, 59));
}

const ENTRIES: SeedEntry[] = [
    {
        studyProgramSlug: "dataingenir",
        name: "Master i informatikk",
        location: "NTNU Trondheim",
        locationType: "innland",
        link: "https://www.ntnu.no/studier/mit",
        summary:
            "Toårig master med spesialiseringer innen blant annet kunstig intelligens, programvaresystemer, databaser og interaksjonsdesign.",
        subjectRequirements:
            "Bachelor i informatikk, dataingeniør eller tilsvarende med minst 80 studiepoeng informatikkemner.",
        otherRequirements: "Karaktersnitt C eller bedre.",
        applicationDeadline: nextDeadline(4, 15),
        quotes: [
            {
                name: "Kari Nordmann",
                quote: "Overgangen fra dataingeniør gikk helt fint — mye av det første semesteret bygger direkte på algoritmer og databaser.",
            },
            {
                name: null,
                quote: "Velg spesialisering tidlig, det gjør emnevalget mye enklere.",
            },
        ],
    },
    {
        studyProgramSlug: "dataingenir",
        name: "MSc Computer Science",
        location: "TU Delft, Nederland",
        locationType: "utland",
        link: "https://www.tudelft.nl/en/education/programmes/masters/computer-science",
        hasFinancialSupport: true,
        financialSupport:
            "Lånekassen dekker skolepenger og levekostnader for fullgradsstudier i utlandet.",
        summary:
            "Internasjonalt anerkjent master med sterke fagmiljøer innen software engineering og distribuerte systemer.",
        subjectRequirements: "Bachelor innen informatikk eller tilsvarende.",
        otherRequirements: "Engelsk språktest (IELTS 6.5 eller TOEFL 90).",
        applicationDeadline: nextDeadline(1, 15),
        quotes: [
            {
                name: "Ola Hansen",
                quote: "Tøft faglig, men et fantastisk studentmiljø. Søk tidlig på bolig!",
            },
        ],
    },
    {
        studyProgramSlug: "digital-infrastruktur-og-cybersikkerhet",
        name: "Master i informasjonssikkerhet",
        location: "NTNU Gjøvik",
        locationType: "innland",
        link: "https://www.ntnu.no/studier/mis",
        summary:
            "Master med fokus på kryptografi, nettverkssikkerhet, digital etterforskning og sikkerhetsledelse.",
        subjectRequirements:
            "Bachelor med minst 30 studiepoeng innen nettverk, sikkerhet eller programmering.",
        applicationDeadline: nextDeadline(4, 15),
        quotes: [
            {
                name: "Ingrid Berg",
                quote: "Digsec ga et veldig godt grunnlag — spesielt nettverksfagene.",
            },
            {
                name: null,
                quote: "Små klasser og tett oppfølging fra forelesere.",
            },
        ],
    },
    {
        studyProgramSlug: "digital-infrastruktur-og-cybersikkerhet",
        name: "MSc Cyber Security",
        location: "DTU, Danmark",
        locationType: "utland",
        link: "https://www.dtu.dk/english/education/msc",
        hasFinancialSupport: true,
        financialSupport:
            "Gratis skolegang for nordiske studenter; Lånekassen gir støtte til levekostnader.",
        summary:
            "Toårig master i København med mye praktisk arbeid og samarbeid med industrien.",
        otherRequirements: "Engelsk språktest kreves.",
        applicationDeadline: nextDeadline(3, 1),
        quotes: [],
    },
    {
        studyProgramSlug: "digital-forretningsutvikling",
        name: "Master i digital transformasjon",
        location: "NTNU Gjøvik",
        locationType: "innland",
        link: "https://www.ntnu.no/studier/mdt",
        summary:
            "Kombinerer teknologi, ledelse og forretningsutvikling — passer godt for deg som vil jobbe i skjæringspunktet mellom IT og forretning.",
        subjectRequirements: "Bachelor innen IT, økonomi eller tilsvarende.",
        applicationDeadline: nextDeadline(4, 15),
        quotes: [
            {
                name: "Sander Lie",
                quote: "Veldig relevant for digfor — mye case-arbeid med ekte bedrifter.",
            },
        ],
    },
    {
        studyProgramSlug: "digital-forretningsutvikling",
        name: "MSc Business Analytics",
        location: "Copenhagen Business School, Danmark",
        locationType: "utland",
        link: "https://www.cbs.dk/en/study/graduate",
        hasFinancialSupport: false,
        summary:
            "Analysefokusert master som bygger videre på data- og forretningsfagene fra bacheloren.",
        otherRequirements: "Krever GMAT eller tilsvarende for enkelte søkere.",
        quotes: [
            {
                name: null,
                quote: "Mye statistikk første semester — repeter gjerne på forhånd.",
            },
        ],
    },
];

/**
 * Example entries for Masterveiledning, so the page has something to show in
 * development. Never runs in production, and only into an empty table.
 */
export async function seedMasterStudies({ db }: AppContext) {
    if (env.NODE_ENV !== "development") return;
    if ((await db.$count(schema.masterStudyEntry)) > 0) return;

    const programs = await db.query.studyProgram.findMany({
        where: inArray(
            schema.studyProgram.slug,
            ENTRIES.map((e) => e.studyProgramSlug),
        ),
    });
    const programIds = new Map(programs.map((p) => [p.slug, p.id]));

    await db.transaction(async (tx) => {
        for (const { studyProgramSlug, quotes, ...entry } of ENTRIES) {
            const studyProgramId = programIds.get(studyProgramSlug);
            if (studyProgramId === undefined) continue;

            const [created] = await tx
                .insert(schema.masterStudyEntry)
                .values({ ...entry, studyProgramId })
                .returning({ id: schema.masterStudyEntry.id });

            if (quotes.length > 0) {
                await tx.insert(schema.masterStudyQuote).values(
                    quotes.map((q, position) => ({
                        ...q,
                        entryId: created!.id,
                        position,
                    })),
                );
            }
        }
    });
}
