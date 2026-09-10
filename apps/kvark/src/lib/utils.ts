export { cn } from "cn";

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
 * Hvor et medlem står i løpet, som en bøtte det går an å telle på:
 * `"1"`–`"5"` for klassetrinnet, `"alumni"` for den som er ferdig, og
 * `"unknown"` når vi ikke vet nok til å plassere dem.
 *
 * Tar tallene serveren har regnet ut, og regner ikke om igjen på kullet.
 * Kullet alene kan ikke svare: masterens første år er 4. klasse, og om
 * årstallet hører til masteren eller bacheloren foran den står ikke i tallet.
 * Da denne bøtta regnet selv, viste admin-listene alle 37 masterstudentene i
 * prod tre klassetrinn for lavt, mens profilen og svarlista — som spør
 * serveren — hadde dem riktig.
 */
export function classLevelBucket(
    classYear: number | null | undefined,
    isAlumni: boolean | null | undefined,
): string {
    if (classYear != null) return String(classYear);
    return isAlumni ? "alumni" : "unknown";
}

/** Etiketten som hører til en {@link classLevelBucket}. */
export function classLevelBucketLabel(bucket: string): string {
    if (bucket === "alumni") return "Alumni";
    if (bucket === "unknown") return "Ukjent kull";
    return `${bucket}. klasse`;
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
