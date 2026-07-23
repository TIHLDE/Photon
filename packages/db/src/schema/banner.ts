import { relations } from "drizzle-orm";
import {
    pgTableCreator,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `banner_${name}`);

/**
 * A timed announcement banner shown at the top of the front page.
 *
 * Visibility is purely time-driven: a banner is live when
 * `visibleFrom <= now < visibleUntil`. There is no separate published flag —
 * admins control exposure by adjusting the window.
 */
export const banner = pgTable("banner", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    url: text("url"),
    visibleFrom: timestamp("visible_from").notNull(),
    visibleUntil: timestamp("visible_until").notNull(),
    createdById: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    ...timestamps,
});

export const bannerRelations = relations(banner, ({ one }) => ({
    creator: one(user, {
        fields: [banner.createdById],
        references: [user.id],
    }),
}));

export type Banner = typeof banner.$inferSelect;
