import { toDate } from "date-fns-tz";

/**
 * Timezone the availability boards are interpreted in. Boards store naive
 * "YYYY-MM-DD" + "HH:mm" strings; this is the zone they refer to.
 */
export const EVENT_TIMEZONE = "Europe/Oslo";

/** ISO calendar date `YYYY-MM-DD` plus `days` (UTC date arithmetic, timezone-agnostic). */
export function addDaysToIsoCalendarDate(
    isoDate: string,
    days: number,
): string {
    const [y, m, d] = isoDate.split("-").map(Number);
    const u = new Date(Date.UTC(y!, m! - 1, d!));
    u.setUTCDate(u.getUTCDate() + days);
    return u.toISOString().slice(0, 10);
}

/**
 * Instants for Google Calendar `events.list` timeMin / timeMax.
 * API semantics: returns events with end > timeMin and start < timeMax.
 * This window includes every event overlapping board days in the event
 * timezone (local midnight of first date through local midnight after last date).
 */
export function googleCalendarListQueryBounds(
    firstDateStr: string,
    lastDateStr: string,
    timeZone: string = EVENT_TIMEZONE,
): { timeMin: Date; timeMax: Date } {
    const timeMin = toDate(`${firstDateStr}T00:00:00`, { timeZone });
    const dayAfterLast = addDaysToIsoCalendarDate(lastDateStr, 1);
    const timeMax = toDate(`${dayAfterLast}T00:00:00`, { timeZone });
    return { timeMin, timeMax };
}

/** UTC instant range a grid slot covers. */
export function slotRangeUtc(
    dateStr: string,
    timeStr: string,
    slotDurationMinutes: number,
    timeZone: string = EVENT_TIMEZONE,
): { start: Date; end: Date } {
    const normalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    const start = toDate(`${dateStr}T${normalized}`, { timeZone });
    const end = new Date(start.getTime() + slotDurationMinutes * 60 * 1000);
    return { start, end };
}

export function intervalsOverlap(
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date,
): boolean {
    return aStart < bEnd && bStart < aEnd;
}
