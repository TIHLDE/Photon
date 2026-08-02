import { addMinutes, format, parse, parseISO } from "date-fns";

/** All "HH:mm" slot starts in the [startTime, endTime) window. */
export function buildTimeSlots(
    startTime: string,
    endTime: string,
    duration = 30,
): string[] {
    const slots: string[] = [];
    let cursor = parse(startTime, "HH:mm", new Date());
    const end = parse(endTime, "HH:mm", new Date());

    while (cursor < end) {
        slots.push(format(cursor, "HH:mm"));
        cursor = addMinutes(cursor, duration);
    }

    return slots;
}

/** Weekday column keys, Monday first. */
export const MOTETID_WEEKDAYS = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
    "SUN",
] as const;

export type MotetidWeekday = (typeof MOTETID_WEEKDAYS)[number];

export function isMotetidWeekday(value: string): value is MotetidWeekday {
    return (MOTETID_WEEKDAYS as readonly string[]).includes(value);
}

/**
 * Sort board columns: chronologically for dates, Monday-first for weekdays.
 * Weekday keys must not be sorted lexicographically — that would put Friday
 * before Monday.
 */
export function normalizeDates(
    dates: string[],
    dateMode: "DATES" | "WEEKDAYS" = "DATES",
): string[] {
    if (dateMode === "WEEKDAYS") {
        return [...dates].sort(
            (a, b) =>
                MOTETID_WEEKDAYS.indexOf(a as MotetidWeekday) -
                MOTETID_WEEKDAYS.indexOf(b as MotetidWeekday),
        );
    }
    return [...dates].sort(
        (a, b) => parseISO(a).getTime() - parseISO(b).getTime(),
    );
}
