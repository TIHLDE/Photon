import { type DbSchema, schema } from "@photon/db";
import { and, eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { StorageService } from "~/lib/storage";

/**
 * Sized for Töddel: the archive's largest issue is just under 40 MB, so 50 MB
 * leaves real margin. Keep nginx's `client_max_body_size` on the API host at or
 * above this — nginx rejects an oversized body with a 413 that carries no CORS
 * headers, so the browser hides it and the user sees a bare network error
 * instead of the message below.
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
 * The asset key a stored URL refers to, or null when the URL points somewhere
 * else (an external image, or the Azure blobs the old site used).
 */
export function assetKeyFromUrl(url: string): string | null {
    try {
        const { pathname } = new URL(url);
        const marker = "/api/assets/";
        const index = pathname.indexOf(marker);
        if (index === -1) return null;

        const key = decodeURIComponent(
            pathname.slice(index + marker.length),
        ).trim();
        return key.length > 0 ? key : null;
    } catch {
        return null;
    }
}

/**
 * Claim the uploaded assets a row now points at.
 *
 * Uploads land as "staged" and the cleanup cron deletes them two days later,
 * so every URL a row stores has to be promoted or the picture vanishes from
 * the page a couple of days after someone set it. URLs that are not our own
 * assets are left alone.
 */
export async function promoteAssetUrls(
    bucket: StorageService,
    urls: (string | null | undefined)[],
): Promise<void> {
    for (const url of urls) {
        const key = url ? assetKeyFromUrl(url) : null;
        if (key) await bucket.promoteAsset(key);
    }
}

/**
 * Delete an asset from both storage and database
 */
export async function deleteAsset(
    bucket: StorageService,
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
