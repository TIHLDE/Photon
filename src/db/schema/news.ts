import { relations } from "drizzle-orm";
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
        onDelete: "set null",
    }),
    emojisAllowed: boolean("emojis_allowed").default(false).notNull(),
    ...timestamps,
});

export const newsRelations = relations(news, ({ one, many }) => ({
    creator: one(user, {
        fields: [news.createdById],
        references: [user.id],
    }),
    reactions: many(newsReaction),
}));

export const newsReaction = pgTable(
    "reaction",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        newsId: uuid("news_id")
            .notNull()
            .references(() => news.id, { onDelete: "cascade" }),
        emoji: varchar("emoji", { length: 32 }).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.newsId] })],
);

export const newsReactionRelations = relations(newsReaction, ({ one }) => ({
    user: one(user, {
        fields: [newsReaction.userId],
        references: [user.id],
    }),
    news: one(news, {
        fields: [newsReaction.newsId],
        references: [news.id],
    }),
}));
