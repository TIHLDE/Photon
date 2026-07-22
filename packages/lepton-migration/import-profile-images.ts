/**
 * Copies members' profile pictures from Lepton's storage into Photon's bucket.
 *
 * 275 of the imported users point at images on Lepton's Azure containers (plus
 * a handful of external hosts). Those containers disappear with Lepton, so the
 * bytes are downloaded and re-uploaded to Photon's S3 bucket the same way the
 * API's own upload route stores files: an object under a generated key plus an
 * `asset_file` row, served publicly via `GET /api/assets/:key`. The user's
 * `image` is then pointed at that URL.
 *
 * Idempotent: users whose image already points at Photon's asset route are
 * skipped, so a re-run only retries what previously failed. Dead source links
 * (expired Discord/Tenor URLs and the like) are counted and listed, never
 * fatal — a member with an unreachable picture simply keeps their old URL.
 *
 * Usage:
 *   DATABASE_URL=... S3_ENDPOINT=... S3_ACCESS_KEY_ID=... \
 *   S3_SECRET_ACCESS_KEY=... S3_BUCKET_NAME=... [S3_REGION=...] \
 *   [S3_USE_SSL=true] [S3_FORCE_PATH_STYLE=false] [PUBLIC_BASE=...] \
 *   bun import-profile-images.ts [--commit]
 */
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { createDb, schema } from "@photon/db";
import { eq } from "drizzle-orm";

const commit = process.argv.includes("--commit");

const need = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        // Explicit on purpose: the shared env schema defaults S3 to localhost
        // MinIO, and a prod run silently uploading to localhost would be the
        // worst kind of success.
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
        return clean || "profile-image";
    } catch {
        return "profile-image";
    }
};

const main = async () => {
    const { users } = (await Bun.file(
        `${import.meta.dir}/data/lepton-users.json`,
    ).json()) as { users: { user_id: string; email: string; image: string }[] };

    const withImage = users.filter((u) => (u.image ?? "").trim());
    console.log(`${withImage.length} brukere med profilbilde i eksporten\n`);

    const db = createDb({ connectionString });

    const photonUsers = await db
        .select({
            id: schema.user.id,
            email: schema.user.email,
            image: schema.user.image,
        })
        .from(schema.user);
    const byEmail = new Map(
        photonUsers.map((u) => [u.email.trim().toLowerCase(), u]),
    );

    let toMigrate = 0;
    let alreadyDone = 0;
    let missingUser = 0;

    type Job = { userId: string; sourceUrl: string; leptonId: string };
    const jobs: Job[] = [];

    for (const u of withImage) {
        const target = byEmail.get(u.email.trim().toLowerCase());
        if (!target) {
            missingUser++;
            console.warn(`  bruker mangler i Photon: ${u.user_id}`);
            continue;
        }
        if (target.image?.includes("/api/assets/")) {
            alreadyDone++;
            continue;
        }
        toMigrate++;
        jobs.push({
            userId: target.id,
            sourceUrl: u.image.trim(),
            leptonId: u.user_id,
        });
    }

    console.log(`skal migreres:      ${toMigrate}`);
    console.log(`allerede migrert:   ${alreadyDone}`);
    console.log(`bruker mangler:     ${missingUser}`);

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
                dead.push(`${job.leptonId} (${res.status})`);
                continue;
            }

            const bytes = Buffer.from(await res.arrayBuffer());
            if (bytes.length === 0 || bytes.length > MAX_BYTES) {
                dead.push(`${job.leptonId} (${bytes.length} bytes)`);
                continue;
            }
            const contentType =
                res.headers.get("content-type")?.split(";")[0] ??
                "application/octet-stream";
            if (!contentType.startsWith("image/")) {
                dead.push(`${job.leptonId} (content-type ${contentType})`);
                continue;
            }

            const originalFilename = filenameOf(job.sourceUrl);
            const now = new Date();
            const key = `profile-images/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${originalFilename}`;

            // Mirrors DatabaseAssetStorageService.upload: object + asset row.
            await bucket.put(key, bytes, { contentType });
            await db
                .insert(schema.asset)
                .values({
                    key,
                    originalFilename,
                    contentType,
                    size: bytes.length,
                    uploadedById: job.userId,
                    visibility: "public",
                })
                .onConflictDoNothing();

            await db
                .update(schema.user)
                .set({ image: `${PUBLIC_BASE}/api/assets/${key}` })
                .where(eq(schema.user.id, job.userId));

            migrated++;
            if (migrated % 25 === 0) {
                console.log(`  ${migrated}/${jobs.length}...`);
            }
        } catch (err) {
            dead.push(
                `${job.leptonId} (${err instanceof Error ? err.message : err})`,
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
