/**
 * Give migrated events the image Lepton still has for them.
 *
 * Two different holes leave an event imageless in Photon while tihlde.org
 * shows a picture:
 *
 * - `image_url` is NULL. Phase 4 only sets the image on rows it *inserts*; a
 *   row it adopts by (title, start) is skipped whole, so an image added or
 *   changed in Lepton after the first import never crossed over. The Fadderuka
 *   events are the visible case — committees kept editing them through July
 *   while the delta imports adopted the existing rows and moved on.
 * - `image_url` points at an `/api/assets/<key>` that no longer exists. That is
 *   the staged-asset cleanup damage `restore-lost-images.ts` was written for;
 *   this script covers the leftovers it could not match.
 *
 * Matching is the fragile part. Phase 4 keys on (title, start), but organizers
 * rename events and move their start times in Lepton afterwards, so the key
 * drifts apart on both sides. Exact match first, then a normalised-title match
 * on the same date, then a unique normalised title within a few days — every
 * inexact hit is printed so it can be eyeballed before committing.
 *
 * Copies land as promoted assets (`status: "ready"`), because unpromoted rows
 * are what the cleanup cron ate the first time around.
 *
 * Idempotent: an event is a candidate only while it has no working image, so a
 * re-run retries the failures and nothing else.
 *
 *   DATABASE_URL=... S3_...=... bun packages/lepton-migration/backfill-event-images.ts
 *   ... --commit     actually download, store and update (default: dry run)
 */
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { schema } from "@photon/db";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseAssetStorageService } from "../../apps/api/src/lib/storage";

const commit = process.argv.includes("--commit");

const rootUrl = process.env.ROOT_URL ?? "https://photon.tihlde.org";
const leptonUrl = process.env.LEPTON_API_URL ?? "https://api.tihlde.org";
const assetPrefix = `${rootUrl}/api/assets/`;

const MAX_BYTES = 40 * 1024 * 1024;
/** How far a start time may drift before a title-only match is refused. */
const MAX_DRIFT_MS = 3 * 24 * 60 * 60 * 1000;

type LeptonEvent = {
    title: string;
    start_date: string;
    image: string | null;
    image_alt: string | null;
};

const db = drizzle(process.env.DATABASE_URL!, { schema });

async function fetchAllPages<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let page: number | null = 1;

    while (page != null) {
        const response = await fetch(
            `${leptonUrl}${path}${path.includes("?") ? "&" : "?"}page=${page}`,
        );
        if (!response.ok) {
            throw new Error(`Lepton returned ${response.status} for ${path}`);
        }
        const payload = (await response.json()) as {
            next: number | null;
            results: T[];
        };
        results.push(...payload.results);
        page = payload.next;
    }
    return results;
}

/** Diacritics folded and punctuation dropped, so "DNV-Bedpres" meets "DNV-bedpres". */
const normalise = (title: string): string =>
    title
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

const exactKey = (title: string, start: Date): string =>
    `${title.trim().toLowerCase()}|${start.toISOString().slice(0, 16)}`;

const dateKey = (title: string, start: Date): string =>
    `${normalise(title)}|${start.toISOString().slice(0, 10)}`;

/** Copy a Lepton image into Photon's bucket, promoted so the cron spares it. */
async function copyImage(
    sourceUrl: string,
    label: string,
): Promise<string | null> {
    let response: Response;
    try {
        response = await fetch(sourceUrl, {
            redirect: "follow",
            signal: AbortSignal.timeout(30_000),
            headers: { "User-Agent": "photon-image-import/1.0 (TIHLDE)" },
        });
    } catch (error) {
        console.warn(
            `  ${label}: host unreachable — ${error instanceof Error ? error.message : error}`,
        );
        return null;
    }
    if (!response.ok) {
        console.warn(`  ${label}: image gone (${response.status})`);
        return null;
    }

    const contentType = (
        response.headers.get("content-type") ?? "image/jpeg"
    ).split(";")[0]!;
    if (!contentType.startsWith("image/")) {
        console.warn(`  ${label}: not an image (${contentType})`);
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
        console.warn(`  ${label}: unusable size (${buffer.length} bytes)`);
        return null;
    }

    const extension = contentType.split("/")[1] ?? "bin";
    const filename = `${label.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80)}.${extension}`;
    const now = new Date();
    const key = `event-images/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${filename}`;

    const bucket = await storage();
    await bucket.upload(key, buffer, {
        originalFilename: filename,
        contentType,
        visibility: "public",
    });
    await bucket.promoteAsset(key);

    return `${rootUrl}/api/assets/${key}`;
}

let cachedStorage: DatabaseAssetStorageService | null = null;
/** Built lazily so a dry run needs no bucket credentials. */
async function storage(): Promise<DatabaseAssetStorageService> {
    if (!cachedStorage) {
        cachedStorage = new DatabaseAssetStorageService(
            await S3ObjectStorageService.create({
                endpoint: process.env.S3_ENDPOINT!,
                accessKeyId: process.env.S3_ACCESS_KEY_ID!,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
                bucketName: process.env.S3_BUCKET_NAME!,
                region: process.env.S3_REGION ?? "us-east-1",
                useSSL: (process.env.S3_USE_SSL ?? "true") === "true",
                forcePathStyle:
                    (process.env.S3_FORCE_PATH_STYLE ?? "false") === "true",
            }),
            db,
        );
    }
    return cachedStorage;
}

/** Which of these asset keys still have a row, so dead references show up. */
async function liveAssetKeys(keys: string[]): Promise<Set<string>> {
    const live = new Set<string>();
    for (let index = 0; index < keys.length; index += 500) {
        const rows = await db
            .select({ key: schema.asset.key })
            .from(schema.asset)
            .where(inArray(schema.asset.key, keys.slice(index, index + 500)));
        for (const row of rows) live.add(row.key);
    }
    return live;
}

const main = async (): Promise<void> => {
    const events = await db
        .select({
            id: schema.event.id,
            title: schema.event.title,
            start: schema.event.start,
            imageUrl: schema.event.imageUrl,
            imageAlt: schema.event.imageAlt,
        })
        .from(schema.event);

    const hosted = events.flatMap((event) =>
        event.imageUrl?.startsWith(assetPrefix)
            ? [{ event, key: event.imageUrl.slice(assetPrefix.length) }]
            : [],
    );
    const live = await liveAssetKeys(hosted.map((h) => h.key));
    const brokenIds = new Set(
        hosted.filter((h) => !live.has(h.key)).map((h) => h.event.id),
    );

    // An event needs help when it has no image at all, or its hosted image
    // reference is dead. Rows still carrying a raw Lepton http url are left to
    // import-content-images.ts, which is what that script is for. Blank counts
    // as absent: a handful of rows hold "" rather than NULL, and they render
    // just as imageless.
    const missing = (event: (typeof events)[number]): boolean =>
        (event.imageUrl ?? "").trim() === "";
    const needy = events.filter(
        (event) => missing(event) || brokenIds.has(event.id),
    );

    console.log(`events:              ${events.length}`);
    console.log(`  no image at all:   ${events.filter(missing).length}`);
    console.log(`  dead asset ref:    ${brokenIds.size}`);
    console.log(`  candidates:        ${needy.length}`);

    const leptonEvents = [
        ...(await fetchAllPages<LeptonEvent>("/events/")),
        ...(await fetchAllPages<LeptonEvent>("/events/?expired=true")),
    ];
    const withImage = leptonEvents.filter((e) => e.image);
    console.log(
        `lepton events:       ${leptonEvents.length} (${withImage.length} with an image)`,
    );

    const byExact = new Map<string, LeptonEvent>();
    const byDate = new Map<string, LeptonEvent[]>();
    const byTitle = new Map<string, LeptonEvent[]>();
    for (const event of withImage) {
        const start = new Date(event.start_date);
        byExact.set(exactKey(event.title, start), event);
        const dk = dateKey(event.title, start);
        byDate.set(dk, [...(byDate.get(dk) ?? []), event]);
        const tk = normalise(event.title);
        byTitle.set(tk, [...(byTitle.get(tk) ?? []), event]);
    }

    type Match = {
        event: (typeof needy)[number];
        source: LeptonEvent;
        how: "exact" | "same-date" | "title-only";
    };
    const matches: Match[] = [];
    const unmatched: typeof needy = [];

    for (const event of needy) {
        const exact = byExact.get(exactKey(event.title, event.start));
        if (exact) {
            matches.push({ event, source: exact, how: "exact" });
            continue;
        }

        const sameDate = byDate.get(dateKey(event.title, event.start));
        if (sameDate?.length === 1) {
            matches.push({ event, source: sameDate[0]!, how: "same-date" });
            continue;
        }

        // Renamed *and* rescheduled: accept a title that is unique in Lepton
        // and whose start has not wandered off more than a few days.
        const sameTitle = byTitle.get(normalise(event.title));
        if (sameTitle?.length === 1) {
            const source = sameTitle[0]!;
            const drift = Math.abs(
                new Date(source.start_date).getTime() - event.start.getTime(),
            );
            if (drift <= MAX_DRIFT_MS) {
                matches.push({ event, source, how: "title-only" });
                continue;
            }
        }

        unmatched.push(event);
    }

    const inexact = matches.filter((m) => m.how !== "exact");
    console.log();
    console.log(`matched in lepton:   ${matches.length}`);
    console.log(`  exact:             ${matches.length - inexact.length}`);
    for (const match of inexact) {
        console.log(
            `  ${match.how}: "${match.event.title}" @ ${match.event.start.toISOString().slice(0, 16)}` +
                ` <- lepton "${match.source.title}" @ ${match.source.start_date.slice(0, 16)}`,
        );
    }
    console.log(
        `no lepton image:     ${unmatched.length} (imageless there too, or Photon-native)`,
    );

    if (!commit) {
        console.log("\n=== DRY RUN — nothing downloaded or written ===");
        console.log("re-run with --commit to apply");
        return;
    }

    console.log();
    let restored = 0;
    const failed: string[] = [];

    for (const { event, source } of matches) {
        const newUrl = await copyImage(
            source.image!,
            `event-${event.title.slice(0, 40)}`,
        );
        if (!newUrl) {
            failed.push(event.title);
            continue;
        }
        await db
            .update(schema.event)
            .set({
                imageUrl: newUrl,
                // Only fill alt text that is actually missing — Photon's own
                // edits win over Lepton's.
                imageAlt:
                    event.imageAlt?.trim() ||
                    source.image_alt?.slice(0, 255) ||
                    null,
            })
            .where(eq(schema.event.id, event.id));
        restored++;
    }

    console.log("=== DONE ===");
    console.log(`restored:            ${restored}`);
    console.log(`dead at source:      ${failed.length}`);
    for (const title of failed) console.log(`  ${title}`);
};

await main();
process.exit(0);
