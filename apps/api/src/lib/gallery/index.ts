import { schema } from "@photon/db";
import { eq, or } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";

/**
 * Turn an album title into a URL-safe slug.
 *
 * Norwegian letters are transliterated rather than stripped, so "Låvefest"
 * becomes "laavefest" and not "l-vefest".
 */
export function slugifyTitle(title: string): string {
    const transliterated = title
        .toLowerCase()
        .replaceAll("æ", "ae")
        .replaceAll("ø", "oe")
        .replaceAll("å", "aa");

    return (
        transliterated
            .normalize("NFD")
            // biome-ignore lint/suspicious/noMisleadingCharacterClass: stripping combining marks is the point
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 70)
    );
}

/**
 * Slug that is free in `gallery_album`, derived from `title`.
 *
 * Titles repeat across years ("Julebord"), and the slug is the public URL key,
 * so collisions get a numeric suffix instead of failing the insert.
 */
export async function generateUniqueAlbumSlug(
    { db }: AppContext,
    title: string,
): Promise<string> {
    const base = slugifyTitle(title) || "galleri";

    for (let attempt = 0; ; attempt++) {
        const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
        const taken = await db.query.galleryAlbum.findFirst({
            where: eq(schema.galleryAlbum.slug, candidate),
            columns: { id: true },
        });
        if (!taken) return candidate;
    }
}

/**
 * Look up an album by slug, falling back to its UUID.
 *
 * The public site links by slug, but older links and admin tooling carry the
 * id, so both resolve.
 */
export async function findAlbumBySlugOrId(
    { db }: AppContext,
    slugOrId: string,
) {
    const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            slugOrId,
        );

    return db.query.galleryAlbum.findFirst({
        where: isUuid
            ? or(
                  eq(schema.galleryAlbum.slug, slugOrId),
                  eq(schema.galleryAlbum.id, slugOrId),
              )
            : eq(schema.galleryAlbum.slug, slugOrId),
    });
}

type AlbumRow = typeof schema.galleryAlbum.$inferSelect;
type EventSummary = { id: string; title: string; slug: string; start: Date };

/**
 * Shape one album row the way every gallery response returns it.
 *
 * Four routes hand back an album, and they must agree field for field — the
 * generated SDK types are derived from this shape.
 */
export function serializeAlbum(
    album: AlbumRow,
    pictureCount: number,
    event: EventSummary | null,
) {
    return {
        id: album.id,
        slug: album.slug,
        title: album.title,
        description: album.description ?? null,
        imageUrl: album.imageUrl ?? null,
        imageAlt: album.imageAlt ?? null,
        pictureCount,
        event: event
            ? {
                  id: event.id,
                  title: event.title,
                  slug: event.slug,
                  start: event.start.toISOString(),
              }
            : null,
        createdById: album.createdById ?? null,
        createdAt: album.createdAt.toISOString(),
        updatedAt: album.updatedAt.toISOString(),
    };
}

/** The event summary an album links to, or null when it links to none. */
export async function findAlbumEvent(
    { db }: AppContext,
    eventId: string | null,
): Promise<EventSummary | null> {
    if (!eventId) return null;

    const found = await db.query.event.findFirst({
        where: eq(schema.event.id, eventId),
        columns: { id: true, title: true, slug: true, start: true },
    });

    return found ?? null;
}

/** Whether the given user created the album (used for ownership checks). */
export async function isAlbumCreator(
    ctx: AppContext,
    slugOrId: string,
    userId: string,
): Promise<boolean> {
    const album = await findAlbumBySlugOrId(ctx, slugOrId);
    return album?.createdById === userId;
}
