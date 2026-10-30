import {
    boolean,
    pgTableCreator,
    primaryKey,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `news_${name}`);

export const news = pgTable("news", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    header: varchar("header", { length: 200 }).notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    imageAlt: varchar("image_alt", { length: 255 }),
    createdById: text("created_by_user_id").references(() => user.id, {
        name: "news_news_created_by_user_id_auth_user_id_fk",
        onDelete: "set null",
    }),
    emojisAllowed: boolean("emojis_allowed").default(false).notNull(),
    ...timestamps,
    /**
     * When the article was taken off the public pages.
     *
     * A timestamp rather than a flag: it answers "since when", which is what
     * anyone looking at an archived article in the admin panel wants to know.
     * Null means the article is live.
     */
    archivedAt: timestamp("archived_at"),
});
export const newsReaction = pgTable(
    "reaction",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, {
                name: "news_reaction_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        newsId: uuid("news_id")
            .notNull()
            .references(() => news.id, {
                name: "news_reaction_news_id_news_news_id_fk",
                onDelete: "cascade",
            }),
        emoji: varchar("emoji", { length: 32 }).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [
        primaryKey({
            name: "news_reaction_user_id_news_id_pk",
            columns: [t.userId, t.newsId],
        }),
    ],
);
