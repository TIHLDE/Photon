import { pgTableCreator, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `apikey_${name}`);

export const managedApiKey = pgTable("api_key", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    keyHash: text("key_hash")
        .notNull()
        .unique("apikey_api_key_key_hash_unique"),
    keyPrefix: text("key_prefix").notNull(),
    createdById: text("created_by_user_id").references(() => user.id, {
        name: "apikey_api_key_created_by_user_id_auth_user_id_fk",
        onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at"),
    permissions: text("permissions").notNull(), // JSON array: ["news:create", "events:view"]
    metadata: text("metadata"), // JSON object
    ...timestamps,
});
