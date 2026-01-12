import { relations } from "drizzle-orm";
import {
    bigint,
    pgTableCreator,
    text,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `asset_${name}`);

/**
 * Asset table for tracking files stored in S3-compatible storage
 */
export const asset = pgTable("file", {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * The S3 object key/path (e.g., "uploads/2024/01/file.pdf")
     */
    key: text("key").notNull().unique(),

    /**
     * The original filename when uploaded
     */
    originalFilename: varchar("original_filename", { length: 512 }).notNull(),

    /**
     * MIME type (e.g., "image/jpeg", "application/pdf")
     */
    contentType: varchar("content_type", { length: 255 }),

    /**
     * File size in bytes
     */
    size: bigint("size", { mode: "number" }).notNull(),

    /**
     * User who uploaded the file (nullable for system uploads)
     */
    uploadedById: uuid("uploaded_by_id").references(() => user.id, {
        onDelete: "set null",
    }),

    ...timestamps,
});

export const assetRelations = relations(asset, ({ one }) => ({
    uploadedBy: one(user, {
        fields: [asset.uploadedById],
        references: [user.id],
    }),
}));

export type Asset = typeof asset.$inferSelect;
export type NewAsset = typeof asset.$inferInsert;
