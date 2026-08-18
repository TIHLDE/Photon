/**
 * Academic-year and class-level maths, shared by the API, the Feide sync and
 * kvark.
 *
 * This module deliberately has no imports: kvark bundles it for the browser,
 * so anything reaching for `@photon/db` or node built-ins here would break the
 * frontend build.
 */

/**
 * The intake year someone registering right now belongs to.
 *
 * The Norwegian academic year starts in August, so a member who signs up in
 * March 2027 started in the 2026 intake, not 2027. Month is zero-indexed, so
 * `>= 7` is August onwards.
 */
export function currentAcademicYear(now = new Date()): number {
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
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
