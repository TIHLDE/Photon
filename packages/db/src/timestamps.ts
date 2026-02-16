import { timestamp } from "drizzle-orm/pg-core";

/**
 * Common timestamp fields for tables.
 *
 * Adds `createdAt` and `updatedAt` fields to a table schema.
 *
 * ### Usage
 * ```
 * export const myTable = pgTable("my_table", {
 *     id: serial("id").primaryKey(),
 *     ...timestamps,
 *     // other fields...
 * });
 * ```
 */
export const timestamps = {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
};
