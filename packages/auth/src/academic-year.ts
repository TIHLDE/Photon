/**
 * Academic-year and class-level maths, shared by the API, the Feide sync and
 * kvark.
 *
 * This module deliberately has no imports: kvark bundles it for the browser,
 * so anything reaching for `@photon/db` or node built-ins here would break the
 * frontend build.
 */

/**
 * Read in Oslo time rather than through `getMonth()`/`getFullYear()`, which
 * answer in whatever zone the code runs in. The API container runs UTC, so on
 * 1 August between 00:00 and 02:00 Norwegian time it would still read July and
 * put a member in the previous intake — while kvark, running in the browser,
 * read August for the same instant. Pinning the zone makes both agree, and
 * makes the boundary land where the academic year actually turns.
 */
const OSLO_YEAR_MONTH_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/**
 * `[year, month, day]` of an instant in Oslo, month zero-indexed.
 *
 * Exported for the other places that key on the Norwegian calendar day rather
 * than the server's, such as the Feide semester-registration windows.
 */
export function osloDateParts(
    now: Date,
): [year: number, month: number, day: number] {
    const [year, month, day] = OSLO_YEAR_MONTH_FORMAT.format(now)
        .split("-")
        .map(Number) as [number, number, number];
    return [year, month - 1, day];
}

/**
 * The intake year someone registering right now belongs to.
 *
 * The Norwegian academic year starts in August, so a member who signs up in
 * March 2027 started in the 2026 intake, not 2027. Month is zero-indexed, so
 * `>= 7` is August onwards.
 */
export function currentAcademicYear(now = new Date()): number {
    const [year, month] = osloDateParts(now);
    return month >= 7 ? year : year - 1;
}

/**
 * Which class level a member who started in `startYear` is on right now.
 *
 * Rolls over in August together with {@link currentAcademicYear}, so the two
 * can never disagree. Returns the raw number with no cap — a member who
 * started five years ago on a three-year bachelor computes to 6, and the
 * caller decides whether that means "alumnus" or "out of range".
 */
export function computeClassYear(startYear: number, now = new Date()): number {
    return currentAcademicYear(now) - startYear + 1;
}

/**
 * Study-programme slugs that run five years rather than three.
 *
 * Mirrors `study_program.type = 'master'` from the seed in
 * `apps/api/src/db/seed/org.ts`. Key on the slug, never the name: the master's
 * slug is `digital-samhandling` while the production group is called "Digital
 * transformasjon".
 */
export const MASTER_STUDY_SLUGS = ["digital-samhandling"] as const;

/** Class levels a member can be on. Bachelors reach 3, masters 5. */
export const MIN_CLASS_YEAR = 1;
export const MAX_CLASS_YEAR = 5;

/**
 * Years of bachelor a master builds on.
 *
 * TIHLDE counts the master's first year as 4. klasse, because that is what it
 * is for the members who took their bachelor here. A master's own cohort year
 * therefore has to be shifted by this before it means anything to anyone.
 */
export const MASTER_CLASS_OFFSET = 3;

/** Whether a study programme slug is one of the five-year masters. */
export function isMasterStudySlug(slug: string | null | undefined): boolean {
    return (
        slug != null && (MASTER_STUDY_SLUGS as readonly string[]).includes(slug)
    );
}

/** Number of years the programme lasts — used to tell students from alumni. */
export function programmeLength(slug: string | null | undefined): number {
    return isMasterStudySlug(slug) ? MAX_CLASS_YEAR : 3;
}
