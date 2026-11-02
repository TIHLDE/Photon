import { assetPublicUrl } from "#/lib/assets";

export interface CookbookEntry {
    type: "file" | "github" | "link";
    title: string;
    course: CourseTypes;
    creator: string | string[];
    isOfficial: boolean;
    url: string;
}

type CookbookStudyIds = keyof typeof StudyCookbook;
type CourseTypes = keyof typeof CookbookCourses;
type GradeTypes = keyof typeof CookbookGradeLabels;

export const CookbookCourses = {
    idatt1001: "IDATT1001 Programmering 1",
    idatt1002: "IDATT1002 Systemutvikling",
    imat1001: "IMAT1001 Matematiske metoder 1",

    idatt2001: "IDATT2001 Programmering 2",
    idatt2101: "IDATT2101 Algoritmer og datastrukturer",
    idatt2103: "IDATT2103 Databaser",
    idatt2104: "IDATT2104 Nettverksprogrammering",
    idatt2105: "IDATT2105 Full-stack applikasjonsutvikling",
    idatt2202: "IDATT2202 Operativsystemer",
    idatt2502: "IDATT2502 Anvendt maskinlæring med prosjekt",
    idatt2503: "IDATT2503 Security and cryptography",

    inft2501: "INFT2501 Applikasjonsutvikling for mobile enheter",
    inft2503: "INFT2503 C++ for programmerere",
    inft1004: "INFT1004 Økonomisk styring og regnskap",

    ingt1001: "INGT1001 Ingeniørfaglig Innføringsemne",
    ingt2300: "INGT2300 Ingeniørfaglig systemtenkning",

    ifyt1001: "IFYT1001 Fysikk",

    dift1003: "DIFT1003 Økonomisk styring og regnskap",

    dcst1003: "DCST1003 Grunnleggende Programmering",
    dcst1007: "DCST1007 Objektorientert programmering",
    dcst2002: "DCST2002 Webutvikling",

    exph0300: "EXPH0300 Examen philosophicum",

    other: "Annet",
};
export const CookbookGradeLabels = {
    "1": "1. Klasse",
    "2": "2. Klasse",
    "3": "3. Klasse",
    "4": "4. Klasse",
    "5": "5. Klasse",
};

export const CookbookStudyLabels: Record<CookbookStudyIds, string> = {
    other: "Annet",
    dataing: "Dataingeniør",
    digfor: "DigFor",
    digsec: "DigSec",
    digtrans: "DigTrans",
};

class EntryBuilder {
    value: CookbookEntry;

    constructor(
        type: CookbookEntry["type"],
        title: CookbookEntry["title"],
        course: CookbookEntry["course"],
        creator: CookbookEntry["creator"],
        isOfficial: CookbookEntry["isOfficial"] = false,
    ) {
        this.value = {
            type,
            title,
            course,
            creator,
            isOfficial,
            url: "about:blank",
        };
    }

    isOfficial(isOfficial: boolean): this {
        this.value.isOfficial = isOfficial;
        return this;
    }

    url(url: string): this {
        this.value.url = url;
        return this;
    }

    build(): CookbookEntry {
        return this.value;
    }
}

const file = (
    title: CookbookEntry["title"],
    course: CookbookEntry["course"],
    creator: CookbookEntry["creator"],
    isOfficial: CookbookEntry["isOfficial"] = false,
) => new EntryBuilder("file", title, course, creator, isOfficial);

const github = (
    title: CookbookEntry["title"],
    course: CookbookEntry["course"],
    creator: CookbookEntry["creator"],
    isOfficial: CookbookEntry["isOfficial"] = false,
) => new EntryBuilder("github", title, course, creator, isOfficial);

const link = (
    title: CookbookEntry["title"],
    course: CookbookEntry["course"],
    creator: CookbookEntry["creator"],
    isOfficial: CookbookEntry["isOfficial"] = false,
) => new EntryBuilder("link", title, course, creator, isOfficial);

export const StudyTranslation: Record<string, CookbookStudyIds> = {
    dataingenir: "dataing",
    "digital-forretningsutvikling": "digfor",
    "digital-infrastruktur-og-cybersikkerhet": "digsec",
    "digital-samhandling": "digtrans",
};

export const StudyCookbook = {
    dataing: {
        "1": [
            file("Tidligere eksamensoppgaver", "idatt1001", "NTNU", true)
                .url(assetPublicUrl("cookbook/examenprog1-zip"))
                .build(),
            file("Sammendrag av Boken", "ingt1001", "Hermann Elton")
                .url(assetPublicUrl("cookbook/notater-innforingsemne.pdf"))
                .build(),
            github("LF øvinger", "idatt2001", "Olaf Rosendahl")
                .url(
                    "https://github.com/olros/NTNU/tree/main/IDATT2001%20Programmering%202",
                )
                .build(),
            github("LF øvinger", "idatt1001", "Olaf Rosendahl")
                .url(
                    "https://github.com/olros/NTNU/tree/main/IDATT1001%20Programmering%201",
                )
                .build(),
            file("Matte 1 kompendium", "imat1001", "NTNU", true)
                .url(assetPublicUrl("cookbook/matematikk1kompendium.pdf"))
                .build(),
            file("Krasjkurs i MM1", "imat1001", "NITO")
                .url(assetPublicUrl("cookbook/kokebok-matte-metoder-1.pdf"))
                .build(),
            file("Sammendrag", "idatt1002", "Hermann Elton")
                .url(assetPublicUrl("cookbook/systemutvikling.pdf"))
                .build(),
        ],
        "2": [
            file("Sammendrag av pensum (Engelsk)", "idatt2202", "Simon Vetter")
                .url(assetPublicUrl("cookbook/operativsystemer-pensum.pdf"))
                .build(),
            file(
                "Building RESTful Web Services with Spring 5",
                "idatt2105",
                "Raja CSP Raman, Ludovic Dewailly",
            )
                .url(
                    assetPublicUrl(
                        "cookbook/ramanrajacspdewailly-2018-buildingrestfulwebserviceswithspring5lev.pdf",
                    ),
                )
                .build(),
            github("Github øvinger v2", "idatt2101", "Zaim Imran")
                .url(
                    "https://github.com/Zenjjim/NTNU-Gammelt/tree/master/TDAT2005%20-%20Algoritmer%20og%20datastrukturer",
                )
                .build(),
            file("Løsningsforslag Øvinger", "idatt2103", "NTNU")
                .isOfficial(true)
                .url(assetPublicUrl("cookbook/databaser-lf-zip"))
                .build(),
            file("Løsningsforslag Øvinger 2022", "ifyt1001", "NTNU", true)
                .url(assetPublicUrl("cookbook/lf-zip"))
                .build(),
            file(
                "Eksamen Hjelpeark v2",
                "idatt2101",
                "B. Kvamme, C. Gran, C. Gützkow, E. Hansen, N. Brand, T. Beránek, T. Gudvangen",
            )
                .url(assetPublicUrl("cookbook/cheatsheet-algdat.pdf"))
                .build(),
            file("Sammendrag av pensum (Engelsk)", "idatt2202", "Hermann Elton")
                .url(assetPublicUrl("cookbook/operating-systems.pdf"))
                .build(),
            file("Alle øvinger (1-4)", "idatt2202", "NTNU")
                .isOfficial(true)
                .url(assetPublicUrl("cookbook/os-solution-zip"))
                .build(),
            file(
                "Eksamen Hjelpeark v3",
                "idatt2101",
                "A. Evensen, S. Eriksen, S. Sørengen, I. Lindholm",
            )
                .url("https://blob.tihlde.org/public/AlgdatCheatsheet.pdf")
                .build(),
            link("Datakom nettside", "idatt2104", "NTNU", true)
                .url("https://sites.google.com/view/tdat2004-datakom/")
                .build(),
            file("Tidligere eksamensoppgaver", "idatt2101", "NTNU", true)
                .url(assetPublicUrl("cookbook/algdat-eksamner-zip"))
                .build(),
            github("Github øvinger v1", "idatt2101", "Hermann Elton")
                .url(
                    "https://github.com/Her0elt/NTNU/tree/main/IDATT2101%20Algoritmer%20og%20datastrukturer",
                )
                .build(),
            file("Eksamen hjelpeark", "idatt2101", "Tobias Rødahl Thingnes")
                .url(assetPublicUrl("cookbook/eksamensark.pdf"))
                .build(),
            github("GitHub Øvinger", "idatt2104", "Olaf Rosendahl")
                .url(
                    "https://github.com/olros/NTNU/tree/main/IDATT2104%20Nettverksprogrammering",
                )
                .build(),
            github("Github øvinger (Kotlin)", "idatt2105", "Olaf Rosendahl")
                .url(
                    "https://github.com/olros/NTNU/tree/main/IDATT2105%20Full-stack%20applikasjonsutvikling",
                )
                .build(),
            github("Github øvinger (Java)", "idatt2105", "Diderik Kramer")
                .url("https://github.com/diderikk/IDATT2105-FullStack")
                .build(),
            file("Sammendrag av pensum", "idatt2104", "Simon Vetter")
                .url(assetPublicUrl("cookbook/datakom.pdf"))
                .build(),
            file("Sammendrag av pensum", "idatt2101", "Hermann Elton")
                .url(assetPublicUrl("cookbook/algdat-sammendrag.pdf"))
                .build(),
        ],
        "3": [
            github("Github øvinger", "inft2501", "Olaf Rosendahl")
                .url(
                    "https://github.com/olros/NTNU/tree/main/INFT2501%20Applikasjonsutvikling%20for%20mobile%20enheter",
                )
                .build(),
            github(
                "Bra eksempel på projekt med rapport",
                "idatt2502",
                "Martin Johannes Nilsen",
            )
                .url(
                    "https://github.com/MartinJohannesNilsen/NTNU-Dataingenior/tree/main/TDAT3025%20-%20Anvendt%20maskinl%C3%A6ring%20med%20prosjekt/Atari_Breakout_openAIGym",
                )
                .build(),
            github("Github Øvinger", "idatt2503", "Martin Hagen")
                .url("https://github.com/hamasl/IDATT2503")
                .build(),
            github("Github øvinger", "idatt2502", "Hermann Elton")
                .url(
                    "https://github.com/Her0elt/NTNU/tree/main/IDATT2502%20Anvendt%20maskinl%C3%A6ring",
                )
                .build(),
            file("Sammendrag", "ingt2300", "Hermann Elton")
                .url(assetPublicUrl("cookbook/ingt-summary.pdf"))
                .build(),
            github("Github øvinger", "inft2503", "Diderik Kramer")
                .url("https://github.com/diderikk/INFT2503-Cpp")
                .build(),
            file("Løsningsforslag øvinger", "inft1004", "NTNU", true)
                .url(assetPublicUrl("cookbook/lf-inft1004-zip"))
                .build(),
        ],
    },
    digfor: {
        "1": [
            file("Samlingsnotat", "dift1003", "Victor Høgheim")
                .url(assetPublicUrl("cookbook/samlingsnotat-dift1003.pdf"))
                .build(),
            file("Eksamensnotater", "dcst1003", "Oskar Nygren")
                .url(assetPublicUrl("cookbook/eksamensnotater-dcst1003.pdf"))
                .build(),
        ],
        "2": [
            file("A-besvarelse", "exph0300", "Victor Høgheim")
                .url(assetPublicUrl("cookbook/exph0300-besvarelse.pdf"))
                .build(),
            file("Generelle tips til oppgaven", "exph0300", "Victor Høgheim")
                .url(assetPublicUrl("cookbook/generelle-tips-exphil.pdf"))
                .build(),
        ],
        "3": [],
    },

    digsec: {
        "1": [
            file("Alle øvinger (1-11)", "dcst1007", "NTNU")
                .url(
                    assetPublicUrl(
                        "cookbook/objektorientert-programmering-kok-zip",
                    ),
                )
                .build(),
        ],
        "2": [
            file("Alle øvinger (1-4)", "idatt2202", "NTNU", true)
                .url(assetPublicUrl("cookbook/os-solution-zip"))
                .build(),
            file("Løsningsforslag", "dcst2002", "NTNU", true)
                .url(assetPublicUrl("cookbook/dcst2002-webutvikling-zip"))
                .build(),
        ],
        "3": [],
    },
    digtrans: {
        "4": [],
        "5": [],
    },

    other: [],
} satisfies Record<
    string,
    Partial<Record<GradeTypes, CookbookEntry[]>> | CookbookEntry[]
>;
