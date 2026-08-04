import { type DbSchema, schema } from "@photon/db";
import { type SQL, getTableName, inArray, like, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { assetKeyFromUrl } from "./index";

/**
 * Every column in the database that can point at an uploaded asset.
 *
 * Two shapes occur: some columns store the public URL
 * (`https://…/api/assets/<key>`), others the raw S3 key. Both are matched.
 *
 * This list is the safety net behind {@link promoteAssetUrls}: the cleanup job
 * consults it before deleting a staged asset, so a route that forgets to
 * promote loses nothing. Keep it complete — `asset-references.test.ts` fails
 * if a new column looks like it belongs here and is listed in neither this
 * table nor {@link NON_ASSET_COLUMNS}.
 */
export const ASSET_REFERENCE_COLUMNS: AssetReference[] = [
    ref(schema.event, schema.event.imageUrl),
    ref(schema.news, schema.news.imageUrl),
    ref(schema.jobPost, schema.jobPost.imageUrl),
    ref(schema.galleryAlbum, schema.galleryAlbum.imageUrl),
    ref(schema.galleryPicture, schema.galleryPicture.imageUrl),
    ref(schema.toddel, schema.toddel.imageUrl),
    ref(schema.toddel, schema.toddel.pdfUrl),
    ref(schema.group, schema.group.imageUrl),
    ref(schema.group, schema.group.logoUrl),
    ref(schema.fine, schema.fine.image),
    ref(schema.userSettings, schema.userSettings.imageUrl),
    ref(schema.user, schema.user.image),
    ref(schema.banner, schema.banner.url),
    ref(schema.contract, schema.contract.fileKey),
    ref(schema.contractSignature, schema.contractSignature.signedPdfKey),
    ref(schema.contractSignature, schema.contractSignature.signatureFileKey),
    ref(schema.application, schema.application.pdfAssetKey),
    ref(schema.applicationAttachment, schema.applicationAttachment.assetKey),
];

/**
 * Columns whose name looks asset-ish but that hold something else. Listed so
 * the coverage test forces a decision on every new column rather than letting
 * one slip through unnoticed.
 */
export const NON_ASSET_COLUMNS: Record<string, string> = {
    "asset_file.key": "the asset itself, not a reference to one",
    "asset_file.original_filename": "a display name, not a key",
    "gallery_picture.source_url": "link to where the picture came from",
    "user_settings.github_url": "external profile",
    "user_settings.linkedin_url": "external profile",
    "event_registration.allow_photo": "a consent flag, not a picture",
    "auth_jwks.public_key": "signing key",
    "auth_jwks.private_key": "signing key",
    "auth_oauth_client.uri": "OAuth client metadata",
    "auth_oauth_client.redirect_uris": "OAuth redirects",
    "auth_oauth_client.post_logout_redirect_uris": "OAuth redirects",
    "org_contract_signature.signed_pdf_hash": "checksum of the PDF",
};

export type AssetReference = {
    table: PgTable;
    column: AnyPgColumn;
    /** "org_group.image_url", used in logs and in the coverage test. */
    label: string;
};

function ref(table: PgTable, column: AnyPgColumn): AssetReference {
    return { table, column, label: `${getTableName(table)}.${column.name}` };
}

/**
 * Which of `keys` are still referenced by a row somewhere, and by what.
 *
 * Matching is on the raw key and on any URL ending in `/api/assets/<key>`, so
 * it survives a change of hostname. A key containing `_` matches slightly more
 * loosely than it should — LIKE reads it as a wildcard — which can only ever
 * keep an asset alive that was about to be deleted, never the reverse.
 */
export async function findAssetReferences(
    db: NodePgDatabase<DbSchema>,
    keys: string[],
): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    if (keys.length === 0) return found;

    for (const { table, column, label } of ASSET_REFERENCE_COLUMNS) {
        const matches: SQL[] = [
            inArray(column, keys),
            ...keys.map((key) => like(column, `%/api/assets/${key}`)),
        ];

        const rows = await db
            .select({ value: sql<string>`${column}` })
            .from(table)
            .where(or(...matches));

        for (const { value } of rows) {
            if (!value) continue;
            const key = assetKeyFromUrl(value) ?? value;
            if (!found.has(key)) found.set(key, label);
        }
    }

    return found;
}
