/**
 * Copies event and group images from Lepton's storage into Photon's bucket.
 *
 * The imported events and groups still carried their Lepton image URLs, all on
 * Azure containers that disappear with Lepton. Same treatment as the profile
 * pictures (`import-profile-images.ts`): download the bytes, store them the way
 * the API's upload route does — bucket object plus a public `asset_file` row —
 * and point the row's image_url at `GET /api/assets/:key`. Content images have
 * no natural uploader, so `uploadedById` stays null.
 *
 * Idempotent: rows whose image already points at the asset route are skipped,
 * and only http(s) sources are considered, so a re-run retries failures only.
 *
 * Usage:
 *   DATABASE_URL=... S3_ENDPOINT=... S3_ACCESS_KEY_ID=... \
 *   S3_SECRET_ACCESS_KEY=... S3_BUCKET_NAME=... [PUBLIC_BASE=...] \
 *   bun import-content-images.ts [--commit]
 */
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { createDb, schema } from "@photon/db";
import { eq } from "drizzle-orm";

const commit = process.argv.includes("--commit");

const need = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        console.error(`${name} må være satt`);
        process.exit(1);
    }
    return value;
};

const connectionString = need("DATABASE_URL");
const PUBLIC_BASE = process.env.PUBLIC_BASE ?? "https://photon.tihlde.org";
const MAX_BYTES = 20 * 1024 * 1024;
const DELAY_MS = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const filenameOf = (url: string): string => {
    try {
        const last = new URL(url).pathname.split("/").filter(Boolean).pop();
        const clean = (last ?? "").replace(/[^a-zA-Z0-9._-]/g, "").slice(-100);
        return clean || "image";
    } catch {
        return "image";
    }
};

type Job = {
    label: string;
    prefix: string;
    sourceUrl: string;
    apply: (newUrl: string) => Promise<void>;
};

const main = async () => {
    const db = createDb({ connectionString });

    const events = await db
        .select({
            id: schema.event.id,
            slug: schema.event.slug,
            imageUrl: schema.event.imageUrl,
        })
        .from(schema.event);

    const groups = await db
        .select({ slug: schema.group.slug, imageUrl: schema.group.imageUrl })
        .from(schema.group);

    const jobs: Job[] = [];
    let alreadyDone = 0;

    for (const e of events) {
        const url = e.imageUrl?.trim();
        if (!url || !/^https?:\/\//.test(url)) continue;
        if (url.includes("/api/assets/")) {
            alreadyDone++;
            continue;
        }
        jobs.push({
            label: `event ${e.slug}`,
            prefix: "event-images",
            sourceUrl: url,
            apply: async (newUrl) => {
                await db
                    .update(schema.event)
                    .set({ imageUrl: newUrl })
                    .where(eq(schema.event.id, e.id));
            },
        });
    }

    for (const g of groups) {
        const url = g.imageUrl?.trim();
        if (!url || !/^https?:\/\//.test(url)) continue;
        if (url.includes("/api/assets/")) {
            alreadyDone++;
            continue;
        }
        jobs.push({
            label: `gruppe ${g.slug}`,
            prefix: "group-images",
            sourceUrl: url,
            apply: async (newUrl) => {
                await db
                    .update(schema.group)
                    .set({ imageUrl: newUrl })
                    .where(eq(schema.group.slug, g.slug));
            },
        });
    }

    console.log(`skal migreres:      ${jobs.length}`);
    console.log(`allerede migrert:   ${alreadyDone}`);

    if (!commit) {
        console.log(
            "\n=== TØRRKJØRING (read-only) — ingen nedlasting/opplasting ===",
        );
        return;
    }

    const bucket = await S3ObjectStorageService.create({
        endpoint: need("S3_ENDPOINT"),
        accessKeyId: need("S3_ACCESS_KEY_ID"),
        secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
        bucketName: need("S3_BUCKET_NAME"),
        region: process.env.S3_REGION || "us-east-1",
        useSSL: (process.env.S3_USE_SSL ?? "true") === "true",
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "false") === "true",
    });

    let migrated = 0;
    const dead: string[] = [];

    for (const job of jobs) {
        try {
            const res = await fetch(job.sourceUrl, {
                redirect: "follow",
                signal: AbortSignal.timeout(20_000),
                headers: { "User-Agent": "photon-image-import/1.0 (TIHLDE)" },
            });
            if (!res.ok) {
                dead.push(`${job.label} (${res.status})`);
                continue;
            }

            const bytes = Buffer.from(await res.arrayBuffer());
            if (bytes.length === 0 || bytes.length > MAX_BYTES) {
                dead.push(`${job.label} (${bytes.length} bytes)`);
                continue;
            }
            const contentType =
                res.headers.get("content-type")?.split(";")[0] ??
                "application/octet-stream";
            if (!contentType.startsWith("image/")) {
                dead.push(`${job.label} (content-type ${contentType})`);
                continue;
            }

            const originalFilename = filenameOf(job.sourceUrl);
            const now = new Date();
            const key = `${job.prefix}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${originalFilename}`;

            await bucket.put(key, bytes, { contentType });
            await db
                .insert(schema.asset)
                .values({
                    key,
                    originalFilename,
                    contentType,
                    size: bytes.length,
                    uploadedById: null,
                    visibility: "public",
                })
                .onConflictDoNothing();

            await job.apply(`${PUBLIC_BASE}/api/assets/${key}`);
            migrated++;
        } catch (err) {
            dead.push(
                `${job.label} (${err instanceof Error ? err.message : err})`,
            );
        }
        await sleep(DELAY_MS);
    }

    console.log();
    console.log("=== KJØRT ===");
    console.log(`migrert:            ${migrated}`);
    console.log(`døde kilder:        ${dead.length}`);
    if (dead.length > 0) {
        console.log("  " + dead.join("\n  "));
    }
};

await main();
process.exit(0);
