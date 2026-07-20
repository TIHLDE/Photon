import { type DbTransaction, schema } from "@photon/db";
import { eq } from "drizzle-orm";

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

/** Turns a title into the url-safe stem of a slug. Exported for testing. */
export const slugifyTitle = (title: string): string =>
    title
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

/** The start date as `2026-11-14`. */
const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Generates a unique slug for an event from its title and start date.
 *
 * The date is always part of the slug rather than a tie-breaker. Titles repeat
 * constantly — "Søndagsplask" runs weekly — so a title-only slug collides for
 * roughly 40% of TIHLDE's events, and a reader cannot tell which occurrence a
 * link points at. `sondagsplask-2026-03-17` is unambiguous.
 *
 * A numeric suffix settles the rare case of two events sharing both a title and
 * a day. It counts up instead of appending a random character, so identical
 * input always yields an identical slug — which is what lets a bulk import run
 * twice without minting a second set of urls.
 *
 * @param title - The title of the event to generate a slug for.
 * @param startDate - When the event starts; appears in the slug.
 * @returns A promise that resolves to a unique slug string.
 */
export const generateUniqueEventSlug = async (
    title: string,
    startDate: Date,
    transaction: DbTransaction,
): Promise<string> => {
    const base = `${slugifyTitle(title)}-${isoDate(startDate)}`;

    let slug = base;
    let attempt = 1;

    while (true) {
        const [existingEvent] = await transaction
            .select()
            .from(schema.event)
            .where(eq(schema.event.slug, slug))
            .limit(1);

        if (!existingEvent) {
            return slug;
        }

        attempt += 1;
        slug = `${base}-${attempt}`;
    }
};
