import {
    date,
    integer,
    pgTableCreator,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";

const pgTable = pgTableCreator((name) => `toddel_${name}`);

/**
 * An issue of TÖDDEL, TIHLDE's student magazine.
 *
 * `edition` is Lepton's own running count, not the number printed on the
 * cover — the magazine was already on #34 when Lepton started counting at 1.
 * It is unique so that importing the archive twice updates rows instead of
 * duplicating them, which is the mistake the news import cannot avoid.
 */
export const toddel = pgTable("issue", {
    edition: integer("edition").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    imageUrl: text("image_url"),
    pdfUrl: text("pdf_url").notNull(),
    publishedAt: date("published_at").notNull(),
    ...timestamps,
});

export type Toddel = typeof toddel.$inferSelect;
