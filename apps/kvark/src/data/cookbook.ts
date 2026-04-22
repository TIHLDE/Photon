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

export const StudyCookbook = {
    dataing: {
        "1": [
            file("Tidligere eksamensoppgaver", "idatt1001", "NTNU", true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationzip/775a2919-8770-47ec-a17f-afe847de69caExamenProg1.zip",
                )
                .build(),
            file("Sammendrag av Boken", "ingt1001", "Hermann Elton")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/233002ba-5c00-4cbc-8065-9b610488813cNotater-innføringsemne.pdf",
                )
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
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/9e8e9a44-6f87-42fa-8400-181bd6a97ceeMatematikk1kompendium.pdf",
                )
                .build(),
            file("Krasjkurs i MM1", "imat1001", "NITO")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/9595b889-b9a8-4188-b87f-6295963e2cd4KOKEBOK_MATTE_METODER_1.pdf",
                )
                .build(),
            file("Sammendrag", "idatt1002", "Hermann Elton")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/69b8c785-d714-4ac5-b203-c38607165a98Systemutvikling.pdf",
                )
                .build(),
        ],
        "2": [
            file("Sammendrag av pensum (Engelsk)", "idatt2202", "Simon Vetter")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/1e4b5000-ba1b-4cb1-a357-9c2861672418Operativsystemer-Pensum.pdf",
                )
                .build(),
            file(
                "Building RESTful Web Services with Spring 5",
                "idatt2105",
                "Raja CSP Raman, Ludovic Dewailly",
            )
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/2e0aadf6-beef-4d62-9f5a-2811c2c2e303RamanRajaCSPDewailly_2018_BuildingRESTfulWebServiceswithSpring5Lev.pdf",
                )
                .build(),
            github("Github øvinger v2", "idatt2101", "Zaim Imran")
                .url(
                    "https://github.com/Zenjjim/NTNU-Gammelt/tree/master/TDAT2005%20-%20Algoritmer%20og%20datastrukturer",
                )
                .build(),
            file("Løsningsforslag Øvinger", "idatt2103", "NTNU")
                .isOfficial(true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/e841f682-3144-442d-9e37-59f376133d7adatabaser_lf.zip",
                )
                .build(),
            file("Løsningsforslag Øvinger 2022", "ifyt1001", "NTNU", true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/f389d986-ceb5-43a9-819d-e146d25175afLF.zip",
                )
                .build(),
            file(
                "Eksamen Hjelpeark v2",
                "idatt2101",
                "B. Kvamme, C. Gran, C. Gützkow, E. Hansen, N. Brand, T. Beránek, T. Gudvangen",
            )
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/cdb9393e-004c-4324-947b-389c4e0a23fbcheatsheet_algdat.pdf",
                )
                .build(),
            file("Sammendrag av pensum (Engelsk)", "idatt2202", "Hermann Elton")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/9d9aa112-c62f-4984-84d2-95ed63d3547eOperating%20Systems.pdf",
                )
                .build(),
            file("Alle øvinger (1-4)", "idatt2202", "NTNU")
                .isOfficial(true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/ed190afe-ccc0-46a5-9f87-5b2dc3455b32OS-solution.zip",
                )
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
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationzip/2f187a63-440b-4421-a77e-290042e889f1algdat_eksamner.zip",
                )
                .build(),
            github("Github øvinger v1", "idatt2101", "Hermann Elton")
                .url(
                    "https://github.com/Her0elt/NTNU/tree/main/IDATT2101%20Algoritmer%20og%20datastrukturer",
                )
                .build(),
            file("Eksamen hjelpeark", "idatt2101", "Tobias Rødahl Thingnes")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/4dfe7059-33be-43ee-963c-328c72b332acEksamensark.pdf",
                )
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
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/015053de-f56d-4244-8fa5-e16426686df5Datakom.pdf",
                )
                .build(),
            file("Sammendrag av pensum", "idatt2101", "Hermann Elton")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/ad6c4b3a-5037-4cd7-862c-8e95fdb035bdAlgdat%20sammendrag.pdf",
                )
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
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/7dd6ba1d-8c6c-4860-90cb-7b3ed53594ebINGT%20Summary.pdf",
                )
                .build(),
            github("Github øvinger", "inft2503", "Diderik Kramer")
                .url("https://github.com/diderikk/INFT2503-Cpp")
                .build(),
            file("Løsningsforslag øvinger", "inft1004", "NTNU", true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationzip/e3ed0b0b-5b0e-4c68-b99e-97aa08e324c7LF-INFT1004.zip",
                )
                .build(),
        ],
    },
    digfor: {
        "1": [
            file("Samlingsnotat", "dift1003", "Victor Høgheim")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/6c015f9d-fb6a-4b23-918c-e6b339d08a93Samlingsnotat%20DIFT1003.pdf",
                )
                .build(),
            file("Eksamensnotater", "dcst1003", "Oskar Nygren")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/3a6a3c1a-f287-486c-89f4-7f31caeaffb6Eksamensnotater%20DCST1003.pdf",
                )
                .build(),
        ],
        "2": [
            file("A-besvarelse", "exph0300", "Victor Høgheim")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/9605176c-d69c-4784-9f78-d1161d961e50EXPH0300%20Besvarelse.pdf",
                )
                .build(),
            file("Generelle tips til oppgaven", "exph0300", "Victor Høgheim")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationpdf/e2b8f3a8-70dc-4792-a414-cd71ce84daf3Generelle%20tips%20EXPHIL.pdf",
                )
                .build(),
        ],
        "3": [],
    },

    digsec: {
        "1": [
            file("Alle øvinger (1-11)", "dcst1007", "NTNU")
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/5fc9edf2-1ef8-45b6-8645-13eeab6468abObjektorientert%20programmering%20kok.zip",
                )
                .build(),
        ],
        "2": [
            file("Alle øvinger (1-4)", "idatt2202", "NTNU", true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/ed190afe-ccc0-46a5-9f87-5b2dc3455b32OS-solution.zip",
                )
                .build(),
            file("Løsningsforslag", "dcst2002", "NTNU", true)
                .url(
                    "https://tihldestorage.blob.core.windows.net/applicationxzipcompressed/75793380-53cd-4b91-950e-dc6663dfa31cDCST2002%20Webutvikling.zip",
                )
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
