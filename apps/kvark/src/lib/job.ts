import { format } from "date-fns";
import { nb } from "date-fns/locale";

// -- Shared display types & helpers (previously in mock/jobs) --

export type JobTypeValue = "full_time" | "part_time" | "summer_job" | "other";

export type ClassYear =
    | "first"
    | "second"
    | "third"
    | "fourth"
    | "fifth"
    | "alumni";

const JOB_TYPE_LABELS: Record<JobTypeValue, string> = {
    full_time: "Fulltid",
    part_time: "Deltid",
    summer_job: "Sommerjobb",
    other: "Annet",
};

const CLASS_YEAR_LABELS: Record<ClassYear, string> = {
    first: "1.",
    second: "2.",
    third: "3.",
    fourth: "4.",
    fifth: "5.",
    alumni: "Alumni",
};

/**
 * Human label for the API job type enum, e.g. "part_time" -> "Deltid".
 */
export function formatJobType(jobType: JobTypeValue): string {
    return JOB_TYPE_LABELS[jobType] ?? "Annet";
}

/**
 * Human label for a class-year range, e.g. ("first", "fifth") -> "1. - 5. klasse".
 * A single year collapses to e.g. "1. klasse"; "alumni" renders as "Alumni".
 */
export function formatClassRange(start: ClassYear, end: ClassYear): string {
    const startLabel = CLASS_YEAR_LABELS[start];
    const endLabel = CLASS_YEAR_LABELS[end];

    if (start === end) {
        return start === "alumni" ? startLabel : `${startLabel} klasse`;
    }
    return `${startLabel} - ${endLabel} klasse`;
}

/**
 * Deadline label for a job. Continuously-hiring jobs (or jobs without a
 * deadline) render as "Fortløpende"; otherwise a Norwegian long date.
 */
export function formatJobDeadline(
    deadline: string | null | undefined,
    isContinuouslyHiring: boolean,
): string {
    if (isContinuouslyHiring || !deadline) {
        return "Fortløpende";
    }
    return format(new Date(deadline), "EEE d. MMM yyyy, HH:mm", { locale: nb });
}

/**
 * Format an ISO timestamp as a Norwegian long date, e.g. "tor. 24. apr. 2026".
 */
export function formatJobDate(iso: string): string {
    return format(new Date(iso), "EEE d. MMM yyyy", { locale: nb });
}
