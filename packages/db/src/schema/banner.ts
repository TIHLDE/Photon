import {
    boolean,
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
        name: "banner_banner_created_by_user_id_auth_user_id_fk",
        onDelete: "set null",
    }),
    ...timestamps,
    linkText: varchar("link_text", { length: 100 }),
    openInNewTab: boolean("open_in_new_tab").notNull().default(true),
});
export type Banner = typeof banner.$inferSelect;
