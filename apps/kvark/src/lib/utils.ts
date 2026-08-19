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
 * Klassetrinn og studieår deles med backend, slik at kullet Feide-synken
 * skriver og klassetrinnet vi viser aldri kan komme i utakt.
 */
export {
    computeClassYear,
    currentAcademicYear,
} from "@photon/auth/academic-year";

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
 * «Dataingeniør · 3. klasse». Returnerer undefined når vi ikke vet noe om
 * studiet.
 *
 * Bare klassetrinn, aldri kull. Kullet er et internt anker — det er slik
 * klassetrinnet regnes ut, og slik prioriteringspoolene er skrudd sammen — men
 * på en profil sier «kull 2023» lite om hvor noen er i løpet, og det er det
 * folk leser etter. Har vi ikke klassetrinn, står studiet alene: den som er
 * ferdig får ikke et årstall som antyder at de fortsatt går der.
 */
export function formatStudyLabel(study: {
    programme?: string | null;
    classYear?: number | null;
}): string | undefined {
    const detail = study.classYear ? `${study.classYear}. klasse` : null;
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
