/**
 * Slug generation, shared by the API and the Lepton migration.
 *
 * Both need identical rules — the migration writes the historical events and
 * the API writes every event created afterwards, and they end up side by side
 * in the same url space. Keeping one implementation here is what stops the two
 * from drifting apart again.
 *
 * Uniqueness is deliberately *not* handled here: the API resolves collisions
 * against the database, while a bulk migration resolves them in memory because
 * its rows are not inserted yet. Only the deterministic part is shared.
 */

/**
 * Norwegian letters that Unicode does not decompose.
 *
 * NFD splits `å` into `a` plus a combining ring, so stripping combining marks
 * leaves the `a` behind. `ø` and `æ` are letters in their own right — they pass
 * through NFD untouched, fall foul of the `[^a-z0-9]` filter and become
 * hyphens. That turned "Søndagsplask" into `s-ndagsplask`. Map them first.
 */
const NORWEGIAN_TRANSLITERATIONS: Record<string, string> = {
    ø: "o",
    Ø: "o",
    æ: "ae",
    Æ: "ae",
    å: "a",
    Å: "a",
};

/** Turns arbitrary text into a url-safe slug stem. */
export const slugifyText = (text: string): string =>
    text
        .replace(/[øØæÆåÅ]/g, (c) => NORWEGIAN_TRANSLITERATIONS[c] ?? c)
        .toLowerCase()
        // normalize unicode (e.g. é → e)
        .normalize("NFD")
        // remove combining diacritical marks
        .replace(/[\p{M}]/gu, "")
        // replace non-alphanumeric with hyphens
        .replace(/[^a-z0-9]+/g, "-")
        // trim hyphens from start and end
        .replace(/^-+|-+$/g, "")
        // collapse multiple hyphens
        .replace(/-{2,}/g, "-");

/** The timezone every TIHLDE event's wall-clock time is expressed in. */
const EVENT_TIMEZONE = "Europe/Oslo";

const OSLO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/**
 * The date an event falls on in Norway, as `2026-11-14`.
 *
 * Deliberately not `toISOString()`, which yields the UTC date. Events are
 * stored as `timestamp without time zone` — wall-clock time in Oslo — and 22 of
 * TIHLDE's historical events start at midnight, so their UTC date is the day
 * before. "TIHLDE TIL ÅRE 2026" starts on 15 January and would have slugged as
 * `2026-01-14`.
 *
 * Pinning the zone also keeps the slug independent of the server's clock: the
 * production container runs UTC while a developer's machine does not, and both
 * must produce the same slug for the same event.
 */
const eventDate = (date: Date): string => OSLO_DATE_FORMAT.format(date);

/**
 * The stem of an event slug: title plus start date, before any uniqueness
 * suffix.
 *
 * The date is always present rather than acting as a tie-breaker. Titles repeat
 * constantly — "Søndagsplask" runs weekly — so a title-only slug collides for
 * roughly 40% of TIHLDE's events, and a reader cannot tell which occurrence a
 * link points at. Falls back to `event` when a title slugs to nothing at all,
 * which the migration has seen with emoji-only titles.
 */
export const buildEventSlugBase = (title: string, startDate: Date): string => {
    const stem = slugifyText(title) || "event";
    return `${stem}-${eventDate(startDate)}`;
};
