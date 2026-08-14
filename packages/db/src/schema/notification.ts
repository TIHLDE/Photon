import {
    boolean,
    index,
    pgTableCreator,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `notification_${name}`);

export const notification = pgTable(
    "notification",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        description: text("description").notNull(),
        link: text("link"),
        isRead: boolean("is_read").default(false).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (t) => [
        /**
         * Everything anyone asks of this table is "my notifications, newest
         * first" — the bell does a count and a first page on every load. With
         * only the primary key to work from, both were full scans: 28 ms and
         * 25 ms against production's 119 017 rows, of which 118 109 were read
         * and thrown away. Per page load. Per member.
         *
         * `created_at` descending is part of the index so the ordering comes
         * for free too, and the read never has to sort.
         *
         * `nullsFirst` is not decoration. `ORDER BY created_at DESC` means
         * `NULLS FIRST` in Postgres, and an index built `DESC NULLS LAST` sorts
         * in a different order than the query asks for — so the planner cannot
         * use it to satisfy the ordering and falls back to reading every row
         * for the user and sorting them. Measured on production, that mismatch
         * cost 34x: 5,5 ms reading 908 rows, against 0,16 ms reading the 25
         * that were actually wanted. The column is `NOT NULL`, so the two
         * orderings can never differ in practice — it is pure bookkeeping that
         * has to line up anyway.
         */
        index("notification_user_id_created_at_idx").on(
            t.userId,
            t.createdAt.desc().nullsFirst(),
        ),
    ],
);

/**
 * Push targets registered by the mobile app — one row per device.
 *
 * The token is unique on its own, not per user: a phone that is handed over or
 * logged in as somebody else gets the same Expo token back, and without the
 * global uniqueness the old owner would keep receiving the new owner's
 * notifications. Re-registering therefore moves the row rather than adding one.
 */
export const notificationDevice = pgTable(
    "device",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        /** Expo push token, e.g. "ExponentPushToken[xxxxxxxx]". */
        token: text("token").notNull(),
        platform: text("platform", { enum: ["ios", "android"] }).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        unique("notification_device_token_unique").on(table.token),
        index("notification_device_userId_idx").on(table.userId),
    ],
);
