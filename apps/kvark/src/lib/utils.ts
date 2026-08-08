import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function nameToSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[æå]/g, "a")
        .replace(/ø/g, "o")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function groupHref(name: string): string {
    return `/grupper/${nameToSlug(name)}`;
}

export function initials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/**
 * Beregn hvilket klassetrinn en student er på ut fra oppstartsåret (kull).
 * Det norske studieåret starter i august, så fra og med august teller man ett
 * trinn opp. Måned er 0-indeksert, så `>= 7` betyr august og senere.
 * Returnerer det rå tallet (ingen cap) — la kalleren bestemme gyldig intervall.
 */
export function computeClassYear(startYear: number, now = new Date()): number {
    return now.getFullYear() - startYear + (now.getMonth() >= 7 ? 1 : 0);
}

type StudyGroupLike = { name: string; type: string };

/**
 * Masterprogrammene ved TIHLDE. Alt annet (Dataingeniør, Digital
 * forretningsutvikling, Digital infrastruktur og cybersikkerhet, Drift,
 * Informasjonsbehandling) er treårig bachelor. Programnavnene har variert
 * mellom Lepton-importen og Feide, så vi matcher på det særegne ordet.
 */
const MASTER_PROGRAMME_MARKERS = ["samhandling", "transformasjon", "master"];

/** Antall år programmet varer — brukes til å avgjøre når noen er alumni. */
export function programmeLength(programme: string | undefined): number {
    if (!programme) return 3;
    const name = programme.toLowerCase();
    return MASTER_PROGRAMME_MARKERS.some((marker) => name.includes(marker))
        ? 5
        : 3;
}

/**
 * Avled studieprogram, klassetrinn og kull fra brukerens gruppemedlemskap.
 * `study`- og `studyyear`-gruppene er en projeksjon av Feide-dataene; typen
 * lagres i UPPERCASE i databasen, så sammenlign case-insensitivt.
 *
 * Klassetrinn vises kun så lenge man faktisk går på studiet — til og med 3.
 * klasse på bachelor, 5. på master. Er man forbi det, er man alumni, og da er
 * kullet (oppstartsåret) det riktige å vise. Tidligere ble klassetrinnet vist
 * så lenge det lå mellom 1 og 5, så en som startet i 2022 og var ferdig i 2025
 * sto oppført som «4. klasse».
 */
export function deriveStudy(
    groups: readonly StudyGroupLike[],
    now = new Date(),
): { programme?: string; classYear?: number; startYear?: number } {
    const programme = groups.find(
        (g) => g.type.toLowerCase() === "study",
    )?.name;

    const startYears = groups
        .filter((g) => g.type.toLowerCase() === "studyyear")
        .map((g) => Number.parseInt(g.name, 10))
        .filter((year) => Number.isFinite(year));

    if (startYears.length === 0) return { programme };

    const startYear = Math.max(...startYears);
    const computed = computeClassYear(startYear, now);
    const isStudying = computed >= 1 && computed <= programmeLength(programme);

    return {
        programme,
        classYear: isStudying ? computed : undefined,
        startYear,
    };
}

/**
 * «Dataingeniør · 3. klasse» mens man studerer, «Dataingeniør · kull 2022»
 * etterpå. Returnerer undefined når vi ikke vet noe om studiet.
 */
export function formatStudyLabel(
    study: ReturnType<typeof deriveStudy>,
): string | undefined {
    const detail = study.classYear
        ? `${study.classYear}. klasse`
        : study.startYear
          ? `kull ${study.startYear}`
          : null;
    return [study.programme, detail].filter(Boolean).join(" · ") || undefined;
}

/**
 * Kort ned fritekst som skal inn i en etikett med fast høyde — typisk en
 * filterpille bygget av et søk brukeren har skrevet. Pillen kan ikke brytes
 * over flere linjer, så uten dette blir den bredere enn skjermen på mobil.
 */
export function truncateLabel(text: string, max = 24): string {
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/**
 * HTTP-statusen bak en feil fra API-klienten, om den finnes.
 *
 * Ligger her og ikke i rutefilene: rutene kodesplittes, og en hjelpefunksjon
 * som bare står i modulen rundt komponenten blir ikke med inn i komponent-
 * chunken — den kaster «is not defined» først i nettleseren.
 */
export function errorStatus(error: unknown): number | undefined {
    const response = (error as { response?: { status?: number } })?.response;
    return typeof response?.status === "number" ? response.status : undefined;
}
