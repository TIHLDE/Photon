import type { MasterStudyEntry } from "@tihlde/sdk";
import { formatOsloDate, formatOsloDateTime } from "#/lib/date";

export type MasterStudyLocationType = MasterStudyEntry["locationType"];

/**
 * The bachelor programmes Masterveiledning is organised by, in sidebar order.
 * Matched on slug because ids differ between environments.
 */
export const MASTER_STUDY_PROGRAMS = [
    { slug: "dataingenir", label: "Dataingeniør" },
    { slug: "digital-infrastruktur-og-cybersikkerhet", label: "DigSec" },
    { slug: "digital-forretningsutvikling", label: "DigFor" },
] as const;

export type MasterStudyProgramSlug =
    (typeof MASTER_STUDY_PROGRAMS)[number]["slug"];

export const MASTER_STUDY_PROGRAM_SLUGS = MASTER_STUDY_PROGRAMS.map(
    (p) => p.slug,
) as [MasterStudyProgramSlug, ...MasterStudyProgramSlug[]];

export const LOCATION_TYPE_LABELS: Record<MasterStudyLocationType, string> = {
    innland: "Innland",
    utland: "Utland",
};

export function formatApplicationDeadline(deadline: string | null): string {
    if (!deadline) return "Ikke oppgitt";
    return formatOsloDateTime(deadline, {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatMasterStudyDate(value: string): string {
    return formatOsloDate(value, {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}
