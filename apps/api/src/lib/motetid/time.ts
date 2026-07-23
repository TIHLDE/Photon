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

/** Sort ISO "YYYY-MM-DD" date strings chronologically. */
export function normalizeDates(dates: string[]): string[] {
    return [...dates].sort(
        (a, b) => parseISO(a).getTime() - parseISO(b).getTime(),
    );
}
