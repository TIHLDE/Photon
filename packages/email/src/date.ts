/**
 * Date formatting for the email templates.
 *
 * Templates are rendered on the API, which runs in UTC, so a bare
 * `toLocaleDateString` dates a late-evening event to the day before for the
 * member reading it. Every date in an email goes through here.
 *
 * This package cannot import `@photon/core` — core depends on it, not the
 * other way around — so the helper lives here rather than in a shared package.
 */

export const OSLO_TIME_ZONE = "Europe/Oslo";

const OSLO_LONG_DATE = new Intl.DateTimeFormat("nb-NO", {
    timeZone: OSLO_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
});

/** A date in Norwegian time, e.g. `26. august 2026`. */
export function formatOsloDate(value: Date | string | number): string {
    return OSLO_LONG_DATE.format(new Date(value));
}
