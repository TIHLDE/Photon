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

export const notification = pgTable("notification", {
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
});

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
