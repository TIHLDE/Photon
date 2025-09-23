import { eq } from "drizzle-orm";
import db, { type DbTransaction, schema } from "~/db";

/**
 * Generates a unique slug for an event based on the given title.
 * If the initial slug already exists in the database, appends a random character
 * to the slug and checks again, repeating until a unique slug is found.
 *
 * @param title - The title of the event to generate a slug for.
 * @returns A promise that resolves to a unique slug string.
 */
export const generateUniqueEventSlug = async (
    title: string,
    transaction?: DbTransaction,
): Promise<string> => {
    let isUnique = false;
    let slug = title
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

    while (!isUnique) {
        const [existingEvent] = await (transaction ?? db)
            .select()
            .from(schema.event)
            .where(eq(schema.event.slug, slug))
            .limit(1);

        if (existingEvent) {
            // appends one random character
            slug += `${Math.random().toString(36).charAt(2)}`;
        } else {
            isUnique = true;
        }
    }

    return slug;
};
