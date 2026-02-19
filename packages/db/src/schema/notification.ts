import {
    boolean,
    pgTableCreator,
    text,
    timestamp,
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
