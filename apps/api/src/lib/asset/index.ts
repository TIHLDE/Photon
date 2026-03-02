import { type DbSchema, schema } from "@photon/db";
import { and, eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { StorageClient } from "~/lib/storage";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(
    mimeType: string,
): mimeType is AllowedMimeType {
    return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Get staged assets older than the specified cutoff date
 * These are candidates for cleanup
 */
export async function getStagedAssetsForCleanup(
    db: NodePgDatabase<DbSchema>,
    cutoffDate: Date,
    limit = 100,
): Promise<schema.Asset[]> {
    return db.query.asset.findMany({
        where: and(
            eq(schema.asset.status, "staged"),
            lt(schema.asset.createdAt, cutoffDate),
        ),
        limit,
        orderBy: (asset, { asc }) => [asc(asset.createdAt)],
    });
}

/**
 * Delete an asset from both storage and database
 */
export async function deleteAsset(
    bucket: StorageClient,
    key: string,
): Promise<void> {
    await bucket.delete(key);
}

/**
 * Generate a unique key for storing an asset
 * Format: uploads/{year}/{month}/{uuid}_{sanitized_filename}
 */
export function generateAssetKey(originalFilename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();

    // Sanitize filename: remove path components and special characters
    const sanitized = originalFilename
        .split(/[/\\]/)
        .pop()
        ?.replace(/[^a-zA-Z0-9._-]/g, "_")
        .substring(0, 100);

    return `uploads/${year}/${month}/${uuid}_${sanitized}`;
}
