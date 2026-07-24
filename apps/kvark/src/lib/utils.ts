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
 * Avled studieprogram og klassetrinn fra brukerens gruppemedlemskap.
 * `study`- og `studyyear`-gruppene er en projeksjon av Feide-dataene; typen
 * lagres i UPPERCASE i databasen, så sammenlign case-insensitivt.
 *
 * Klassetrinn vises bare når det havner i intervallet 1–5 (bachelor 3 + master
 * 2). Utenfor dette (typisk alumni, siden medlemskap aldri fjernes) utelates
 * `classYear` slik at kun programnavnet vises. Vi kan ikke skille bachelor fra
 * master ut fra `session.groups`, så 1–5 er den pragmatiske grensen.
 */
export function deriveStudy(
    groups: readonly StudyGroupLike[],
    now = new Date(),
): { programme?: string; classYear?: number } {
    const programme = groups.find(
        (g) => g.type.toLowerCase() === "study",
    )?.name;

    const startYears = groups
        .filter((g) => g.type.toLowerCase() === "studyyear")
        .map((g) => Number.parseInt(g.name, 10))
        .filter((year) => Number.isFinite(year));

    let classYear: number | undefined;
    if (startYears.length > 0) {
        const computed = computeClassYear(Math.max(...startYears), now);
        if (computed >= 1 && computed <= 5) {
            classYear = computed;
        }
    }

    return { programme, classYear };
}
