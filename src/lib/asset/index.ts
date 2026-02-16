import { and, eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type DbSchema, schema } from "~/db";
import type { StorageClient } from "~/lib/storage";

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, isAllowedMimeType } from "./schema";

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
