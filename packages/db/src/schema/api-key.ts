import { relations } from "drizzle-orm";
import { pgTableCreator, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `apikey_${name}`);

export const managedApiKey = pgTable("api_key", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    createdById: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at"),
    permissions: text("permissions").notNull(), // JSON array: ["news:create", "events:view"]
    metadata: text("metadata"), // JSON object
    ...timestamps,
});

export const managedApiKeyRelations = relations(managedApiKey, ({ one }) => ({
    creator: one(user, {
        fields: [managedApiKey.createdById],
        references: [user.id],
    }),
}));
