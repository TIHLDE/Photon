/**
 * Calendar-day boundaries in Norwegian time.
 *
 * "Today" is a Norwegian day, never the container's. The API runs in UTC, so
 * `new Date().setHours(0, 0, 0, 0)` lands on 02:00 Oslo in summer and 01:00 in
 * winter — the first hours of the Norwegian day fall on the wrong side of the
 * boundary, and the same code answers differently on a developer's machine.
 */

import { toDate } from "date-fns-tz";

export const OSLO_TIME_ZONE = "Europe/Oslo";

const OSLO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: OSLO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/** The Norwegian calendar date of an instant, as `2026-08-26`. */
export function isoDateInOslo(now: Date = new Date()): string {
    return OSLO_DATE_FORMAT.format(now);
}

/** The instant midnight Oslo began on the Norwegian day `now` falls in. */
export function startOfTodayInOslo(now: Date = new Date()): Date {
    return toDate(`${isoDateInOslo(now)}T00:00:00`, {
        timeZone: OSLO_TIME_ZONE,
    });
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function osloFormatter(
    options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
    const key = JSON.stringify(options);
    let formatter = formatterCache.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("nb-NO", {
            ...options,
            timeZone: OSLO_TIME_ZONE,
        });
        formatterCache.set(key, formatter);
    }
    return formatter;
}

/**
 * A date in Norwegian time, e.g. `26. august 2026`.
 *
 * Everything the API renders for a member — PDFs, emails, notifications — goes
 * through here rather than `toLocaleDateString`, which formats in the process's
 * zone. The container runs UTC, so that is two hours behind the reader.
 */
export function formatOsloDate(
    value: Date,
    options: Intl.DateTimeFormatOptions = {},
): string {
    return osloFormatter(options).format(value);
}

/** Date and time in Norwegian time, e.g. `26.8.2026, 22:05:07`. */
export function formatOsloDateTime(
    value: Date,
    options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    },
): string {
    return osloFormatter(options).format(value);
}
