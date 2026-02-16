import { relations } from "drizzle-orm";
import {
    bigint,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

/**
 * Asset status variants for staging mechanism
 * - staged: File uploaded but not yet attached to a resource (will be cleaned up after 2 days)
 * - ready: File promoted and attached to a resource (permanent)
 */
export const assetStatusVariants = ["staged", "ready"] as const;
export const assetStatus = pgEnum("asset_status", assetStatusVariants);

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
     * Note: auth_user.id is text type, so we must use text here
     */
    uploadedById: text("uploaded_by_id").references(() => user.id, {
        onDelete: "set null",
    }),

    /**
     * Asset status for staging mechanism
     * - staged: Uploaded but not yet attached to a resource
     * - ready: Promoted and attached to a resource
     */
    status: assetStatus("status").notNull().default("staged"),

    /**
     * Timestamp when the asset was promoted from staged to ready
     */
    promotedAt: timestamp("promoted_at"),

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
