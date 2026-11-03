import { defineRelationsPart, sql } from "drizzle-orm";
import {
    boolean,
    check,
    index,
    integer,
    pgTableCreator,
    primaryKey,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { event } from "./event";

const pgTable = pgTableCreator((name) => `wrapped_${name}`);

/**
 * Where a photo came from: shot with the camera screen, or picked from the
 * phone's camera roll. Both cost a shot; the organizer sees which is which.
 */
export const wrappedPhotoSources = ["camera", "camera_roll"] as const;
export type WrappedPhotoSource = (typeof wrappedPhotoSources)[number];

/**
 * How the story is watched: scrolled up and down like TikTok, or swiped to
 * the side as a stack of cards like Tinder. The organizer picks.
 */
export const wrappedStoryLayouts = ["feed", "cards"] as const;
export type WrappedStoryLayout = (typeof wrappedStoryLayouts)[number];

/**
 * The disposable camera of one arrangement.
 *
 * Its own table rather than columns on `event`: the camera is an add-on most
 * events never turn on, and keeping it apart means the feature can change
 * without touching the event row every route reads.
 *
 * No row means the camera was never configured, which reads the same as
 * `enabled = false`.
 */
export const wrappedCamera = pgTable(
    "camera",
    {
        eventId: uuid("event_id")
            .primaryKey()
            .references(() => event.id, { onDelete: "cascade" }),
        enabled: boolean("enabled").notNull().default(false),
        shotsPerPerson: integer("shots_per_person").notNull().default(5),

        /**
         * Set while the story is live for members. Cleared on unpublish, so
         * the organizer can take the story down without losing anything.
         */
        publishedAt: timestamp("published_at"),

        /**
         * Set by the first publish and never cleared. Attendees are notified
         * once, when this goes from null to set — unpublishing and publishing
         * again must not ping everyone a second time.
         */
        firstPublishedAt: timestamp("first_published_at"),

        storyLayout: text("story_layout", { enum: wrappedStoryLayouts })
            .notNull()
            .default("feed"),

        ...timestamps,
    },
    (t) => [
        check(
            "wrapped_camera_shots_per_person_positive",
            sql`${t.shotsPerPerson} > 0`,
        ),
        check(
            "wrapped_camera_story_layout_valid",
            sql`${t.storyLayout} in ('feed', 'cards')`,
        ),
    ],
);

/**
 * One photo taken with an arrangement's camera.
 *
 * Hidden until the organizer publishes: `assetKey` is the raw storage key of a
 * private asset, never a URL, so nothing that renders URLs can leak it and the
 * open asset route never serves it.
 *
 * A photo is the member's own draft until the camera closes; only submitted
 * photos reach the organizer. Drafts still left when the camera closes are
 * sent in automatically a minute later (submitClosedDrafts); until then the
 * member can still delete them.
 */
export const wrappedPhoto = pgTable(
    "photo",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        eventId: uuid("event_id")
            .notNull()
            .references(() => event.id, { onDelete: "cascade" }),

        /**
         * Cascades on purpose: a member who deletes their account takes the
         * photos they took with them.
         */
        uploadedById: text("uploaded_by_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        assetKey: text("asset_key").notNull().unique(),

        source: text("source", { enum: wrappedPhotoSources })
            .notNull()
            .default("camera"),

        /** Set when the member submits the photo; null means a draft. */
        submittedAt: timestamp("submitted_at"),

        /** Set when the organizer picks the photo; null means not picked. */
        selectedAt: timestamp("selected_at"),

        ...timestamps,
    },
    (t) => [
        check(
            "wrapped_photo_source_valid",
            sql`${t.source} in ('camera', 'camera_roll')`,
        ),
        /**
         * The quota check counts one member's photos for one event on every
         * upload, and the organizer's list reads by event — both are served by
         * this index.
         */
        index("wrapped_photo_event_id_uploaded_by_id_idx").on(
            t.eventId,
            t.uploadedById,
        ),
    ],
);

/**
 * A member's like on one photo in a published story. The composite key is the
 * "at most once" rule: liking twice is the same row.
 */
export const wrappedPhotoLike = pgTable(
    "photo_like",
    {
        photoId: uuid("photo_id")
            .notNull()
            .references(() => wrappedPhoto.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.photoId, t.userId] })],
);

export const WRAPPED_COMMENT_MAX_LENGTH = 500;

/**
 * A comment on one photo in a published story. Plain text; the length limit is
 * checked here as well as in the route, so no other writer can get past it.
 */
export const wrappedPhotoComment = pgTable(
    "photo_comment",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        photoId: uuid("photo_id")
            .notNull()
            .references(() => wrappedPhoto.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        body: text("body").notNull(),
        ...timestamps,
    },
    (t) => [
        check(
            "wrapped_photo_comment_body_length",
            sql`char_length(${t.body}) between 1 and ${sql.raw(String(WRAPPED_COMMENT_MAX_LENGTH))}`,
        ),
        /** The comment sheet reads one photo's comments, oldest first. */
        index("wrapped_photo_comment_photo_id_created_at_idx").on(
            t.photoId,
            t.createdAt,
        ),
    ],
);

export const wrappedRelations = defineRelationsPart(
    {
        wrappedCamera,
        wrappedPhoto,
        wrappedPhotoLike,
        wrappedPhotoComment,
        event,
        user,
    },
    (r) => ({
        wrappedCamera: {
            event: r.one.event({
                from: r.wrappedCamera.eventId,
                to: r.event.id,
                optional: false,
            }),
        },
        wrappedPhoto: {
            event: r.one.event({
                from: r.wrappedPhoto.eventId,
                to: r.event.id,
                optional: false,
            }),
            uploadedBy: r.one.user({
                from: r.wrappedPhoto.uploadedById,
                to: r.user.id,
                optional: false,
            }),
            likes: r.many.wrappedPhotoLike({
                from: r.wrappedPhoto.id,
                to: r.wrappedPhotoLike.photoId,
            }),
            comments: r.many.wrappedPhotoComment({
                from: r.wrappedPhoto.id,
                to: r.wrappedPhotoComment.photoId,
            }),
        },
        wrappedPhotoLike: {
            photo: r.one.wrappedPhoto({
                from: r.wrappedPhotoLike.photoId,
                to: r.wrappedPhoto.id,
                optional: false,
            }),
            user: r.one.user({
                from: r.wrappedPhotoLike.userId,
                to: r.user.id,
                optional: false,
            }),
        },
        wrappedPhotoComment: {
            photo: r.one.wrappedPhoto({
                from: r.wrappedPhotoComment.photoId,
                to: r.wrappedPhoto.id,
                optional: false,
            }),
            author: r.one.user({
                from: r.wrappedPhotoComment.userId,
                to: r.user.id,
                optional: false,
            }),
        },
    }),
);

export type WrappedCamera = typeof wrappedCamera.$inferSelect;
export type NewWrappedCamera = typeof wrappedCamera.$inferInsert;
export type WrappedPhoto = typeof wrappedPhoto.$inferSelect;
export type NewWrappedPhoto = typeof wrappedPhoto.$inferInsert;
export type WrappedPhotoLike = typeof wrappedPhotoLike.$inferSelect;
export type WrappedPhotoComment = typeof wrappedPhotoComment.$inferSelect;
