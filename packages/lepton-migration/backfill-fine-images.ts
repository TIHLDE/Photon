/**
 * Backfills fine (bot) evidence images that the original migration dropped.
 *
 * Lepton's Fine model carries an `image` URL (OptionalImage), but Photon's
 * `org_fine` table had no image column when the data was migrated, so every
 * fine landed without its picture. This script reads the `group_fine` export
 * (fetched with `fetch-lepton-tables.ts group_fine`), matches rows to migrated
 * fines by id (char32 -> uuid), downloads each image and stores it the way the
 * API's upload route does — bucket object plus a public `asset_file` row —
 * then points `org_fine.image` at `GET /api/assets/:key`. Same treatment as
 * `import-content-images.ts`.
 *
 * Idempotent: fines that already have an image are skipped, and only http(s)
 * sources are considered, so a re-run retries failures only.
 *
 * Usage:
 *   LEPTON_TOKEN=$(cat .lepton-token) bun fetch-lepton-tables.ts group_fine
 *   DATABASE_URL=... S3_ENDPOINT=... S3_ACCESS_KEY_ID=... \
 *   S3_SECRET_ACCESS_KEY=... S3_BUCKET_NAME=... [PUBLIC_BASE=...] \
 *   bun backfill-fine-images.ts [--commit]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { createDb, schema } from "@photon/db";
import { eq, inArray } from "drizzle-orm";
import { char32ToUuid } from "./src/mappings";

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
const TABLES_DIR = process.env.LEPTON_TABLES_DIR ?? "data/tables";
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

type LeptonFineRow = { id: string; image: string | null };

const main = async () => {
    const db = createDb({ connectionString });

    const raw = readFileSync(join(TABLES_DIR, "group_fine.json"), "utf8");
    const leptonFines = JSON.parse(raw) as LeptonFineRow[];

    const withImage = leptonFines.filter(
        (f) => f.image && /^https?:\/\//.test(f.image.trim()),
    );
    console.log(
        `group_fine-rader: ${leptonFines.length}, med bilde: ${withImage.length}`,
    );

    const ids = withImage.map((f) => char32ToUuid(f.id));
    const existing = await db
        .select({ id: schema.fine.id, image: schema.fine.image })
        .from(schema.fine)
        .where(inArray(schema.fine.id, ids));
    const existingById = new Map(existing.map((f) => [f.id, f]));

    type Job = { fineId: string; sourceUrl: string };
    const jobs: Job[] = [];
    let alreadyDone = 0;
    let missing = 0;

    for (const f of withImage) {
        const fineId = char32ToUuid(f.id);
        const row = existingById.get(fineId);
        if (!row) {
            missing++;
            continue;
        }
        if (row.image) {
            alreadyDone++;
            continue;
        }
        jobs.push({ fineId, sourceUrl: (f.image as string).trim() });
    }

    console.log(`skal migreres:      ${jobs.length}`);
    console.log(`allerede migrert:   ${alreadyDone}`);
    console.log(`finnes ikke i prod: ${missing}`);

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
                dead.push(`bot ${job.fineId} (${res.status})`);
                continue;
            }

            const bytes = Buffer.from(await res.arrayBuffer());
            if (bytes.length === 0 || bytes.length > MAX_BYTES) {
                dead.push(`bot ${job.fineId} (${bytes.length} bytes)`);
                continue;
            }
            const contentType =
                res.headers.get("content-type")?.split(";")[0] ??
                "application/octet-stream";
            if (!contentType.startsWith("image/")) {
                dead.push(`bot ${job.fineId} (content-type ${contentType})`);
                continue;
            }

            const originalFilename = filenameOf(job.sourceUrl);
            const now = new Date();
            const key = `fine-images/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${originalFilename}`;

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

            await db
                .update(schema.fine)
                .set({ image: `${PUBLIC_BASE}/api/assets/${key}` })
                .where(eq(schema.fine.id, job.fineId));
            migrated++;
        } catch (err) {
            dead.push(
                `bot ${job.fineId} (${err instanceof Error ? err.message : err})`,
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
