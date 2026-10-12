import { relations, sql } from "drizzle-orm";
import {
    boolean,
    check,
    index,
    integer,
    pgTableCreator,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { event } from "./event";

const pgTable = pgTableCreator((name) => `wrapped_${name}`);

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
        ...timestamps,
    },
    (t) => [
        check(
            "wrapped_camera_shots_per_person_positive",
            sql`${t.shotsPerPerson} > 0`,
        ),
    ],
);

export const wrappedCameraRelations = relations(wrappedCamera, ({ one }) => ({
    event: one(event, {
        fields: [wrappedCamera.eventId],
        references: [event.id],
    }),
}));

/**
 * One photo taken with an arrangement's camera.
 *
 * Hidden until the organizer publishes: `assetKey` is the raw storage key of a
 * private asset, never a URL, so nothing that renders URLs can leak it and the
 * open asset route never serves it.
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

        /** Set when the organizer picks the photo; null means not picked. */
        selectedAt: timestamp("selected_at"),

        ...timestamps,
    },
    (t) => [
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

export const wrappedPhotoRelations = relations(wrappedPhoto, ({ one }) => ({
    event: one(event, {
        fields: [wrappedPhoto.eventId],
        references: [event.id],
    }),
    uploadedBy: one(user, {
        fields: [wrappedPhoto.uploadedById],
        references: [user.id],
    }),
}));

export type WrappedCamera = typeof wrappedCamera.$inferSelect;
export type NewWrappedCamera = typeof wrappedCamera.$inferInsert;
export type WrappedPhoto = typeof wrappedPhoto.$inferSelect;
export type NewWrappedPhoto = typeof wrappedPhoto.$inferInsert;
