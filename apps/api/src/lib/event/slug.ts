import { buildEventSlugBase } from "@photon/core/slug";
import { type DbTransaction, schema } from "@photon/db";
import { eq } from "drizzle-orm";

/**
 * Generates a unique slug for an event from its title and start date.
 *
 * The stem — title plus date — comes from `@photon/core/slug`, shared with the
 * Lepton migration so imported and newly created events cannot drift into
 * different url formats.
 *
 * Uniqueness is settled here against the database, since rows written through
 * the API land one at a time. A numeric suffix covers the rare case of two
 * events sharing both a title and a day; it counts up instead of appending a
 * random character, so identical input always yields an identical slug.
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
    const base = buildEventSlugBase(title, startDate);

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
