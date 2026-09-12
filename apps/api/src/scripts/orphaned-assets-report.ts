/**
 * Which uploaded assets no row points at any more.
 *
 * Read-only. Nothing here writes — not to the database, and not to the bucket:
 * it builds its own S3 client that only ever sends ListObjectsV2, because
 * `createStorageClient` calls `ensureBucketExists` on the way up, and that can
 * create. Safe to point at production.
 *
 * ### Why this exists
 *
 * An upload lands as `staged` and the hourly cron deletes it two days later.
 * The moment a row claims it, it is promoted to `ready` — and until
 * `enqueueAssetRelease` existed, nothing ever took it back. A row deleted
 * afterwards left the file behind for good: invisible to the cron, still
 * costing one of the bucket's 120 000 objects, and in the case of a fine's
 * picture still showing who was fined for what.
 *
 * The new release path covers the routes that delete a row themselves. It does
 * not cover what is already lying there, nor a row that disappears down a
 * foreign key — `fine.user_id` and `fine.group_slug` both cascade. This report
 * is how we size that before deciding whether to delete anything.
 *
 * ### Usage
 *
 *     bun run src/scripts/orphaned-assets-report.ts
 *     bun run src/scripts/orphaned-assets-report.ts --bucket
 *     bun run src/scripts/orphaned-assets-report.ts --keys
 *
 * `--bucket` also walks the bucket to count objects, which is the only way to
 * see the variant cache and any object with no `asset` row at all. It pages
 * through every object, so it is slow and left off by default.
 *
 * `--keys` prints the orphaned keys themselves. Off by default because a key
 * ends in the uploader's own filename, which is often a person's name.
 */

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { env } from "@photon/core/env";
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { asc, gt } from "drizzle-orm";
import { collectReferencedAssetKeys } from "~/lib/asset/references";

/**
 * Its own connection with the request timeouts off: reading every asset row
 * and all eighteen referencing columns is well past the limit the API runs
 * with.
 */
const db = createDb({
    connectionString: env.DATABASE_URL,
    timeouts: DISABLED_TIMEOUTS,
});

/** Matches the cleanup cron's `STAGING_EXPIRY_DAYS`. */
const STAGING_EXPIRY_DAYS = 2;

const ASSET_PAGE_SIZE = 5000;
const KEYS_SHOWN = 40;

type Asset = {
    key: string;
    status: string;
    visibility: string;
    size: number;
    createdAt: Date;
};

type Bucket = {
    label: string;
    count: number;
    bytes: number;
    oldest: Date;
};

function formatBytes(bytes: number): string {
    const units = ["B", "kB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;

    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit++;
    }

    return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

/**
 * Thousands grouped by hand: `toLocaleString` is blocked repo-wide because it
 * formats dates in whatever zone the process runs in, and the rule cannot tell
 * a number from a date.
 */
function formatCount(count: number): string {
    return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function isoDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * "uploads/2026/09" for an upload, the first segment for anything else. Groups
 * the report by month without turning every key into its own line.
 */
function prefixOf(key: string): string {
    const parts = key.split("/");
    if (parts[0] === "uploads" && parts.length >= 3) {
        return parts.slice(0, 3).join("/");
    }

    return parts.length > 1 ? `${parts[0]}/` : "(ingen prefiks)";
}

function tally(assets: Asset[], label: (asset: Asset) => string): Bucket[] {
    const buckets = new Map<string, Bucket>();

    for (const asset of assets) {
        const key = label(asset);
        const bucket = buckets.get(key);

        if (!bucket) {
            buckets.set(key, {
                label: key,
                count: 1,
                bytes: asset.size,
                oldest: asset.createdAt,
            });
            continue;
        }

        bucket.count++;
        bucket.bytes += asset.size;
        if (asset.createdAt < bucket.oldest) bucket.oldest = asset.createdAt;
    }

    return [...buckets.values()].sort((a, b) => b.count - a.count);
}

async function readAllAssets(): Promise<Asset[]> {
    const assets: Asset[] = [];
    let after = "";

    while (true) {
        const page = await db
            .select({
                key: schema.asset.key,
                status: schema.asset.status,
                visibility: schema.asset.visibility,
                size: schema.asset.size,
                createdAt: schema.asset.createdAt,
            })
            .from(schema.asset)
            .where(after ? gt(schema.asset.key, after) : undefined)
            .orderBy(asc(schema.asset.key))
            .limit(ASSET_PAGE_SIZE);

        assets.push(...page);

        const last = page.at(-1);
        if (!last || page.length < ASSET_PAGE_SIZE) break;
        after = last.key;
    }

    return assets;
}

type BucketWalk = {
    /** Objects per top-level prefix. */
    counts: Map<string, number>;
    /**
     * Objects with no `asset` row, variant cache aside. A row deleted without
     * its file is exactly what this whole report is about, and it is the only
     * orphan the database cannot see on its own.
     */
    withoutRow: number;
};

async function countBucketObjects(assetKeys: Set<string>): Promise<BucketWalk> {
    const client = new S3Client({
        endpoint: `${env.S3_USE_SSL ? "https" : "http"}://${env.S3_ENDPOINT}`,
        region: env.S3_REGION,
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        requestHandler: {
            requestTimeout: 120_000,
            connectionTimeout: 15_000,
            // Without this the timeout above expires without aborting anything.
            throwOnRequestTimeout: true,
        },
    });

    const counts = new Map<string, number>();
    let withoutRow = 0;
    let token: string | undefined;

    do {
        const page = await client.send(
            new ListObjectsV2Command({
                Bucket: env.S3_BUCKET_NAME,
                ContinuationToken: token,
            }),
        );

        for (const object of page.Contents ?? []) {
            if (!object.Key) continue;
            const group = object.Key.split("/")[0] ?? "(ingen prefiks)";
            counts.set(group, (counts.get(group) ?? 0) + 1);

            if (group !== "derivatives" && !assetKeys.has(object.Key)) {
                withoutRow++;
            }
        }

        token = page.NextContinuationToken;
    } while (token);

    return { counts, withoutRow };
}

async function main() {
    const flags = process.argv.slice(2);
    const showKeys = flags.includes("--keys");
    const walkBucket = flags.includes("--bucket");

    const assets = await readAllAssets();
    const referenced = await collectReferencedAssetKeys(db);

    const assetKeys = new Set(assets.map((asset) => asset.key));
    const orphans = assets.filter((asset) => !referenced.has(asset.key));

    const stagingCutoff = new Date();
    stagingCutoff.setDate(stagingCutoff.getDate() - STAGING_EXPIRY_DAYS);

    /** The cron's own backlog: staged, unreferenced, and old enough to go. */
    const stagedExpired = orphans.filter(
        (asset) => asset.status === "staged" && asset.createdAt < stagingCutoff,
    );
    /** Staged and recent — an upload someone may still be filling in a form with. */
    const stagedFresh = orphans.filter(
        (asset) =>
            asset.status === "staged" && asset.createdAt >= stagingCutoff,
    );
    /** Promoted and abandoned. Nothing in Photon ever deletes these. */
    const stranded = orphans.filter((asset) => asset.status !== "staged");

    const totalBytes = orphans.reduce((sum, asset) => sum + asset.size, 0);
    const strandedBytes = stranded.reduce((sum, asset) => sum + asset.size, 0);

    /**
     * A reference that names no asset row of ours. Mostly external addresses —
     * the Azure blobs the Lepton fines and news carry — but a file whose row
     * was deleted out from under it would look the same, so the two are not
     * separated here.
     */
    const danglingReferences = [...referenced.keys()].filter(
        (key) => !assetKeys.has(key),
    );

    const line = (label: string, value: string, note?: string) => {
        console.log(
            `${label.padEnd(26)}${value.padStart(8)}${note ? `  — ${note}` : ""}`,
        );
    };

    console.log("");
    line("asset-rader", formatCount(assets.length));
    line("  referert av en rad", formatCount(assets.length - orphans.length));
    line(
        "  uten referanse",
        `${formatCount(orphans.length)} (${formatBytes(totalBytes)})`,
    );
    line(
        `    staged, over ${STAGING_EXPIRY_DAYS} døgn`,
        formatCount(stagedExpired.length),
        "cronen tar disse",
    );
    line(
        "    staged, ferske",
        formatCount(stagedFresh.length),
        "kan være en opplasting midt i et skjema",
    );
    line(
        "    promotert, forlatt",
        `${formatCount(stranded.length)} (${formatBytes(strandedBytes)})`,
        "ingen rydder disse",
    );
    console.log("");
    line(
        "referanser uten asset-rad",
        formatCount(danglingReferences.length),
        "eksterne adresser (Lepton-bildene), eller en fil som har mistet raden sin",
    );

    if (stranded.length > 0) {
        console.log("\nForlatte assets per prefiks");
        for (const bucket of tally(stranded, (asset) => prefixOf(asset.key))) {
            console.log(
                `  ${bucket.label.padEnd(18)} ${formatCount(bucket.count).padStart(7)} rader  ${formatBytes(bucket.bytes).padStart(9)}  eldste ${isoDay(bucket.oldest)}`,
            );
        }

        console.log("\nForlatte assets per synlighet");
        for (const bucket of tally(stranded, (asset) => asset.visibility)) {
            console.log(
                `  ${bucket.label.padEnd(18)} ${formatCount(bucket.count).padStart(7)} rader  ${formatBytes(bucket.bytes).padStart(9)}`,
            );
        }

        if (showKeys) {
            console.log(`\nNøkler (${stranded.length})`);
            for (const asset of stranded.slice(0, KEYS_SHOWN)) {
                console.log(`  ${isoDay(asset.createdAt)}  ${asset.key}`);
            }
            if (stranded.length > KEYS_SHOWN) {
                console.log(
                    `  … og ${formatCount(stranded.length - KEYS_SHOWN)} flere`,
                );
            }
        } else {
            console.log(
                "\n--keys lister nøklene. Utelatt her: en nøkkel ender på opplasterens eget filnavn.",
            );
        }
    }

    if (!walkBucket) {
        console.log(
            "\n--bucket teller objektene i bøtta óg (variantcachen og objekter uten asset-rad). Tar tid.",
        );
        return;
    }

    const { counts, withoutRow } = await countBucketObjects(assetKeys);
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

    console.log(`\nObjekter i ${env.S3_BUCKET_NAME}: ${formatCount(total)}`);
    for (const [prefix, count] of [...counts].sort((a, b) => b[1] - a[1])) {
        console.log(
            `  ${`${prefix}/`.padEnd(18)} ${formatCount(count).padStart(8)}`,
        );
    }
    console.log(
        `\nobjekter uten asset-rad: ${formatCount(withoutRow)} (utenom derivatives/) — filer som overlevde raden sin`,
    );
    console.log(
        "\nKvota er på ANTALL objekter, ikke størrelse. derivatives/ er variantcachen: den har ingen asset-rad, regenereres ved behov, og teller likevel.",
    );
}

main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
        console.error(error);
        process.exit(1);
    });
