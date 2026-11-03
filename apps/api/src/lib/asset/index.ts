import { type DbRelations, schema } from "@photon/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPAppException } from "~/lib/errors";
import type { StorageService } from "~/lib/storage";
import { IMAGE_VARIANT_WIDTHS, imageVariantKey } from "./image";

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
    db: NodePgDatabase<DbRelations>,
    cutoffDate: Date,
    limit = 100,
): Promise<schema.Asset[]> {
    return db.query.asset.findMany({
        where: { status: "staged", createdAt: { lt: cutoffDate } },
        limit,
        orderBy: { createdAt: "asc" },
    });
}

/**
 * The asset key a stored URL refers to, or null when the URL points somewhere
 * else (an external image).
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
 * Whether this caller uploaded the asset. An asset with no recorded uploader
 * belongs to nobody, so it never matches.
 */
export function isAssetUploader(
    asset: Pick<schema.Asset, "uploadedById">,
    callerId: string | null | undefined,
): boolean {
    return Boolean(callerId) && asset.uploadedById === callerId;
}

/**
 * Refuse a client-supplied URL unless the caller uploaded the asset behind it
 * or the row being saved already holds it.
 *
 * Storing a URL is what gives it power: claiming can make a public asset
 * private, a gallery or avatar row makes a private one readable, and replacing
 * the row deletes whatever nothing else references — including files an
 * external app keeps track of in its own database.
 *
 * `heldByRow` is what lets a re-save through, and an editor keep a picture
 * another editor uploaded. Call before the row is written. A missing asset
 * answers the same as someone else's, so this does not confirm which keys exist.
 */
export async function assertMayUseAssetUrls(
    { db }: { db: NodePgDatabase<DbRelations> },
    callerId: string | null | undefined,
    urls: (string | null | undefined)[],
    heldByRow: (string | null | undefined)[] = [],
): Promise<void> {
    const held = new Set(heldByRow.map((url) => assetKeyOf(url)));
    const keys = [
        ...new Set(
            urls
                .map((url) => assetKeyOf(url))
                .filter((key): key is string => key !== null && !held.has(key)),
        ),
    ];
    if (keys.length === 0) return;

    const assets = await db.query.asset.findMany({
        where: { key: { in: keys } },
        columns: { key: true, uploadedById: true },
    });
    const usable = new Set(
        assets
            .filter((asset) => isAssetUploader(asset, callerId))
            .map((asset) => asset.key),
    );

    if (keys.some((key) => !usable.has(key))) {
        throw HTTPAppException.Forbidden(
            "Du kan bare bruke filer du selv har lastet opp.",
        );
    }
}

function assetKeyOf(url: string | null | undefined): string | null {
    return url ? assetKeyFromUrl(url) : null;
}

/**
 * Claim the uploaded assets a row now points at.
 *
 * Uploads land as "staged" and the cleanup cron deletes them two days later,
 * so every URL a row stores has to be promoted or the picture vanishes from
 * the page a couple of days after someone set it. URLs that are not our own
 * assets are left alone.
 *
 * Kall den *etter* at raden er skrevet. Stemplingen tar filen ut av
 * opprydningsjobbens rekkevidde, så en lagring som blir avvist etterpå ville
 * etterlatt en fil ingen rydder. Rekkefølgen er trygg fordi jobben redder
 * filer en rad peker på i stedet for å slette dem.
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
 * Som {@link promoteAssetUrls}, men gjør også assetet privat: raden som peker
 * på filen avgjør hvor privat den er, ikke hva klienten husket å be om ved
 * opplasting.
 */
export async function claimPrivateAssetUrls(
    bucket: StorageService,
    urls: (string | null | undefined)[],
): Promise<void> {
    for (const url of urls) {
        const key = url ? assetKeyFromUrl(url) : null;
        if (!key) continue;

        await bucket.promoteAsset(key);
        await bucket.setAssetVisibility(key, "private");
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

    // Variantene har ingen asset-rad, så uten denne runden blir de liggende
    // for alltid — og bøtta sperres på antall objekter, ikke størrelse.
    for (const width of IMAGE_VARIANT_WIDTHS) {
        await bucket.deleteObject(imageVariantKey(key, width));
    }
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
