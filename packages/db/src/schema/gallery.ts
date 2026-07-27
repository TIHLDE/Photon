import { relations } from "drizzle-orm";
import {
    index,
    pgTableCreator,
    text,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { event } from "./event";

const pgTable = pgTableCreator((name) => `gallery_${name}`);

/**
 * A photo album ("galleri" on the website).
 *
 * Ported from Lepton's `gallery_album`. The one deliberate difference is the
 * slug: Lepton recomputed `slugify(title)` on every save and never enforced
 * uniqueness, so two albums with the same title collided. Here the slug is
 * unique and stable once assigned, because it is the public URL key
 * (`/galleri/$slug`).
 */
export const galleryAlbum = pgTable("album", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description"),

    /** Cover image shown in the album list. */
    imageUrl: text("image_url"),
    imageAlt: varchar("image_alt", { length: 200 }),

    /**
     * The arrangement the pictures are from, when there is one.
     *
     * Nullable and `set null` on delete: plenty of albums are not tied to a
     * single event ("Hyttetur V22"), and deleting an event must never take
     * the pictures with it.
     */
    eventId: uuid("event_id").references(() => event.id, {
        onDelete: "set null",
    }),

    createdById: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),

    ...timestamps,
});

export const galleryAlbumRelations = relations(
    galleryAlbum,
    ({ one, many }) => ({
        creator: one(user, {
            fields: [galleryAlbum.createdById],
            references: [user.id],
        }),
        event: one(event, {
            fields: [galleryAlbum.eventId],
            references: [event.id],
        }),
        pictures: many(galleryPicture),
    }),
);

/**
 * A single picture inside an album.
 *
 * Lepton used `on_delete=SET_NULL` here, which left orphaned rows nothing ever
 * cleaned up. Deleting an album should take its pictures with it, so this
 * cascades.
 */
export const galleryPicture = pgTable(
    "picture",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        albumId: uuid("album_id")
            .notNull()
            .references(() => galleryAlbum.id, { onDelete: "cascade" }),
        imageUrl: text("image_url").notNull(),

        /**
         * Where an imported picture originally came from (a Lepton blob URL).
         *
         * The import copies each image into Photon's own storage, so
         * `imageUrl` is a fresh URL that cannot identify the source. Keeping
         * the original makes the import re-runnable without duplicating every
         * picture. Null for anything uploaded through Photon.
         */
        sourceUrl: text("source_url"),

        imageAlt: varchar("image_alt", { length: 200 }),
        title: varchar("title", { length: 100 }),
        description: text("description"),
        ...timestamps,
    },
    (t) => [index("gallery_picture_album_id_idx").on(t.albumId)],
);

export const galleryPictureRelations = relations(galleryPicture, ({ one }) => ({
    album: one(galleryAlbum, {
        fields: [galleryPicture.albumId],
        references: [galleryAlbum.id],
    }),
}));

export type GalleryAlbum = typeof galleryAlbum.$inferSelect;
export type NewGalleryAlbum = typeof galleryAlbum.$inferInsert;
export type GalleryPicture = typeof galleryPicture.$inferSelect;
export type NewGalleryPicture = typeof galleryPicture.$inferInsert;
