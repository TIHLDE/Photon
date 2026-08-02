import { relations } from "drizzle-orm";
import {
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

// NOTE: literal full table names instead of pgTableCreator. The creator's
// prefix is runtime-only — at the type level the table keeps its base name,
// and a base name like "event" collides with the events feature's table,
// silently breaking relational query inference across the whole schema.

export const motetidSlotStatusVariants = ["AVAILABLE", "IF_NEEDED"] as const;

export const motetidSlotStatus = pgEnum(
    "motetid_slot_status",
    motetidSlotStatusVariants,
);

export const motetidDateModeVariants = ["DATES", "WEEKDAYS"] as const;

/**
 * What the board's columns mean: concrete calendar dates (a one-off activity)
 * or recurring weekdays (a fixed weekly meeting slot).
 */
export const motetidDateMode = pgEnum(
    "motetid_date_mode",
    motetidDateModeVariants,
);

/** Weekday column keys, Monday first — the WEEKDAYS-mode counterpart to dates. */
export const motetidWeekdays = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
    "SUN",
] as const;

/**
 * A scheduling event ("når passer det?") — a when2meet-style availability
 * board. Ported from the standalone time.tihlde.org app.
 *
 * Dates and times are intentionally stored as strings ("YYYY-MM-DD" / "HH:mm")
 * — the whole grid model is string-keyed, and native types would only invite
 * timezone drift. A weekday board reuses the same string columns with
 * "MON".."SUN" keys, so the grid, slots and heatmap need no parallel model.
 */
export const motetidEvent = pgTable(
    "motetid_event",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        /** Short share-link slug (6 hex chars). */
        slug: varchar("slug", { length: 12 }).notNull().unique(),
        title: text("title").notNull(),
        /**
         * Nullable on purpose: deleting a user must not delete the group's
         * scheduling board.
         */
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        /** Whether `dates` holds calendar dates or weekday keys. */
        dateMode: motetidDateMode("date_mode").notNull().default("DATES"),
        /**
         * Candidate columns: ISO "YYYY-MM-DD" strings in DATES mode,
         * `motetidWeekdays` keys ("MON".."SUN") in WEEKDAYS mode.
         */
        dates: text("dates").array().notNull(),
        /** Daily window start, "HH:mm". */
        startTime: varchar("start_time", { length: 5 }).notNull(),
        /** Daily window end, "HH:mm". */
        endTime: varchar("end_time", { length: 5 }).notNull(),
        slotDuration: integer("slot_duration").notNull().default(30),
        /** After this the board becomes read-only. */
        deadline: timestamp("deadline", { withTimezone: true }),
        ...timestamps,
    },
    (table) => [index().on(table.createdById)],
);

export const motetidParticipant = pgTable(
    "motetid_participant",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        eventId: uuid("event_id")
            .notNull()
            .references(() => motetidEvent.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        /** Nullable: the data model supports anonymous participants. */
        userId: text("user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        ...timestamps,
    },
    (table) => [
        uniqueIndex().on(table.eventId, table.userId),
        index().on(table.userId),
    ],
);

export const motetidSlot = pgTable(
    "motetid_slot",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        participantId: uuid("participant_id")
            .notNull()
            .references(() => motetidParticipant.id, { onDelete: "cascade" }),
        eventId: uuid("event_id")
            .notNull()
            .references(() => motetidEvent.id, { onDelete: "cascade" }),
        /** "YYYY-MM-DD", or a weekday key on a WEEKDAYS-mode board. */
        date: varchar("date", { length: 10 }).notNull(),
        /** "HH:mm" */
        time: varchar("time", { length: 5 }).notNull(),
        status: motetidSlotStatus("status").notNull(),
    },
    (table) => [
        uniqueIndex().on(table.participantId, table.date, table.time),
        index().on(table.eventId, table.date, table.time),
    ],
);

/**
 * Google Calendar OAuth tokens for the busy-time overlay on the board.
 *
 * TODO(follow-up): encrypt tokens at rest and store `expires_at` so we can
 * refresh proactively instead of reacting to 401s.
 */
export const motetidGoogleCredential = pgTable("motetid_google_credential", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    ...timestamps,
});

export const motetidEventRelations = relations(
    motetidEvent,
    ({ one, many }) => ({
        createdBy: one(user, {
            fields: [motetidEvent.createdById],
            references: [user.id],
        }),
        participants: many(motetidParticipant),
        slots: many(motetidSlot),
    }),
);

export const motetidParticipantRelations = relations(
    motetidParticipant,
    ({ one, many }) => ({
        event: one(motetidEvent, {
            fields: [motetidParticipant.eventId],
            references: [motetidEvent.id],
        }),
        user: one(user, {
            fields: [motetidParticipant.userId],
            references: [user.id],
        }),
        slots: many(motetidSlot),
    }),
);

export const motetidSlotRelations = relations(motetidSlot, ({ one }) => ({
    participant: one(motetidParticipant, {
        fields: [motetidSlot.participantId],
        references: [motetidParticipant.id],
    }),
    event: one(motetidEvent, {
        fields: [motetidSlot.eventId],
        references: [motetidEvent.id],
    }),
}));

export const motetidGoogleCredentialRelations = relations(
    motetidGoogleCredential,
    ({ one }) => ({
        user: one(user, {
            fields: [motetidGoogleCredential.userId],
            references: [user.id],
        }),
    }),
);

export type MotetidEvent = typeof motetidEvent.$inferSelect;
export type MotetidParticipant = typeof motetidParticipant.$inferSelect;
export type MotetidSlot = typeof motetidSlot.$inferSelect;
export type MotetidSlotStatus = (typeof motetidSlotStatusVariants)[number];
export type MotetidDateMode = (typeof motetidDateModeVariants)[number];
export type MotetidWeekday = (typeof motetidWeekdays)[number];
export type MotetidGoogleCredential =
    typeof motetidGoogleCredential.$inferSelect;
