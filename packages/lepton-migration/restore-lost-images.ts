/**
 * Re-import the content images that the staged-asset cleanup deleted.
 *
 * `import-content-images.ts` and `import-profile-images.ts` wrote their
 * `asset_file` rows without promoting them. `status` defaults to `staged`, and
 * the cleanup cron deletes staged assets older than two days — object and row
 * both — so every event, group and profile image imported from Lepton
 * disappeared about two days after each import, leaving 1 419 rows pointing at
 * `/api/assets/<key>` URLs that 404. Those scripts now promote (see the
 * `status: "ready"` they pass); this one restores what was already lost.
 *
 * A dead row no longer carries its Lepton URL — the import overwrote it — so
 * the source has to be resolved from Lepton again: events by (title, start),
 * groups by slug, both from Lepton's public API.
 *
 * Idempotent: a row counts as broken only when its asset key has no
 * `asset_file` row, so re-running picks up whatever failed last time.
 *
 * Profile and fine images come from Lepton's superuser-gated export instead of
 * the public API, so those two need LEPTON_TOKEN.
 *
 *   DATABASE_URL=... S3_...=... bun packages/lepton-migration/restore-lost-images.ts
 *   ... --commit          to actually write
 *   ... --events          only events (default: every kind)
 *   ... --groups          only groups
 *   ... --users           only profile images   (needs LEPTON_TOKEN)
 *   ... --fines           only fine images      (needs LEPTON_TOKEN)
 */
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { schema } from "@photon/db";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseAssetStorageService } from "../../apps/api/src/lib/storage";
import { char32ToUuid } from "./src/mappings";

const commit = process.argv.includes("--commit");
const kinds = ["events", "groups", "users", "fines"] as const;
const picked = kinds.filter((k) => process.argv.includes(`--${k}`));
const wants = (kind: (typeof kinds)[number]): boolean =>
    picked.length === 0 || picked.includes(kind);
const leptonToken = process.env.LEPTON_TOKEN;

const rootUrl = process.env.ROOT_URL ?? "https://photon.tihlde.org";
const leptonUrl = process.env.LEPTON_API_URL ?? "https://api.tihlde.org";
const assetPrefix = `${rootUrl}/api/assets/`;

type LeptonEvent = {
    title: string;
    start_date: string;
    image: string | null;
};

type LeptonGroup = {
    slug: string;
    image: string | null;
};

const db = drizzle(process.env.DATABASE_URL!, { schema });

const bucket = new DatabaseAssetStorageService(
    await S3ObjectStorageService.create({
        endpoint: process.env.S3_ENDPOINT!,
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        bucketName: process.env.S3_BUCKET_NAME!,
        region: process.env.S3_REGION!,
        useSSL: process.env.S3_USE_SSL === "true",
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    }),
    db,
);

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

/** Events and groups are matched on this, so both sides must build it alike. */
const eventKey = (title: string, start: Date): string =>
    `${title.trim().toLowerCase()}|${start.toISOString().slice(0, 16)}`;

/**
 * Copy one Lepton image into Photon's storage, promoted so the cleanup cron
 * leaves it alone — the omission that caused this whole repair.
 */
async function copyImage(
    sourceUrl: string,
    label: string,
    prefix: string,
): Promise<string | null> {
    let response: Response;
    try {
        response = await fetch(sourceUrl);
    } catch {
        console.warn(`  ${label}: image host unreachable — ${sourceUrl}`);
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

    const extension = contentType.split("/")[1] ?? "bin";
    const filename = `${label.replace(/[^a-zA-Z0-9._-]/g, "-")}.${extension}`;
    const now = new Date();
    const key = `${prefix}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}_${filename}`;

    const buffer = Buffer.from(await response.arrayBuffer());
    await bucket.upload(key, buffer, {
        originalFilename: filename,
        contentType,
        visibility: "public",
    });
    await bucket.promoteAsset(key);

    return `${rootUrl}/api/assets/${key}`;
}

/** The asset keys that still exist, so a broken reference can be spotted. */
async function liveAssetKeys(keys: string[]): Promise<Set<string>> {
    const live = new Set<string>();
    for (let i = 0; i < keys.length; i += 500) {
        const rows = await db
            .select({ key: schema.asset.key })
            .from(schema.asset)
            .where(inArray(schema.asset.key, keys.slice(i, i + 500)));
        for (const row of rows) live.add(row.key);
    }
    return live;
}

const keyOf = (url: string): string | null =>
    url.startsWith(assetPrefix) ? url.slice(assetPrefix.length) : null;

async function restoreEvents(): Promise<void> {
    const events = await db
        .select({
            id: schema.event.id,
            title: schema.event.title,
            start: schema.event.start,
            imageUrl: schema.event.imageUrl,
        })
        .from(schema.event);

    const candidates = events.flatMap((e) => {
        const key = e.imageUrl ? keyOf(e.imageUrl) : null;
        return key ? [{ ...e, key }] : [];
    });
    const live = await liveAssetKeys(candidates.map((c) => c.key));
    const broken = candidates.filter((c) => !live.has(c.key));

    console.log(
        `events: ${broken.length} broken image references (of ${candidates.length} hosted)`,
    );
    if (broken.length === 0) return;

    const leptonEvents = [
        ...(await fetchAllPages<LeptonEvent>("/events/")),
        ...(await fetchAllPages<LeptonEvent>("/events/?expired=true")),
    ];
    const sourceByKey = new Map<string, string>();
    for (const e of leptonEvents) {
        if (e.image) {
            sourceByKey.set(eventKey(e.title, new Date(e.start_date)), e.image);
        }
    }
    console.log(`  ${sourceByKey.size} Lepton events carry an image`);

    let restored = 0;
    let unmatched = 0;
    let failed = 0;

    for (const event of broken) {
        const source = sourceByKey.get(eventKey(event.title, event.start));
        if (!source) {
            unmatched++;
            continue;
        }
        if (!commit) {
            restored++;
            continue;
        }

        const newUrl = await copyImage(
            source,
            `event-${event.title.slice(0, 40)}`,
            "event-images",
        );
        if (!newUrl) {
            failed++;
            continue;
        }
        await db
            .update(schema.event)
            .set({ imageUrl: newUrl })
            .where(eq(schema.event.id, event.id));
        restored++;
        if (restored % 50 === 0) console.log(`  ${restored} restored…`);
    }

    console.log(
        `events: ${restored} restored, ${unmatched} without a Lepton match, ${failed} unreachable at source`,
    );
}

async function restoreGroups(): Promise<void> {
    const groups = await db
        .select({ slug: schema.group.slug, imageUrl: schema.group.imageUrl })
        .from(schema.group);

    const candidates = groups.flatMap((g) => {
        const key = g.imageUrl ? keyOf(g.imageUrl) : null;
        return key ? [{ ...g, key }] : [];
    });
    const live = await liveAssetKeys(candidates.map((c) => c.key));
    const broken = candidates.filter((c) => !live.has(c.key));

    console.log(
        `groups: ${broken.length} broken image references (of ${candidates.length} hosted)`,
    );
    if (broken.length === 0) return;

    const leptonGroups = (await (
        await fetch(`${leptonUrl}/groups/`)
    ).json()) as LeptonGroup[];
    const sourceBySlug = new Map(
        leptonGroups.filter((g) => g.image).map((g) => [g.slug, g.image!]),
    );

    // Photon renamed a few groups when the org structure was redone, so the
    // slug is not always the Lepton one.
    const leptonSlug: Record<string, string> = { kok: "kontkom" };

    let restored = 0;
    let unmatched = 0;
    let failed = 0;

    for (const group of broken) {
        const source = sourceBySlug.get(leptonSlug[group.slug] ?? group.slug);
        if (!source) {
            unmatched++;
            continue;
        }
        if (!commit) {
            restored++;
            continue;
        }

        const newUrl = await copyImage(
            source,
            `group-${group.slug}`,
            "group-images",
        );
        if (!newUrl) {
            failed++;
            continue;
        }
        await db
            .update(schema.group)
            .set({ imageUrl: newUrl })
            .where(eq(schema.group.slug, group.slug));
        restored++;
    }

    console.log(
        `groups: ${restored} restored, ${unmatched} without a Lepton match, ${failed} unreachable at source`,
    );
}

/** The export endpoints both sit behind Lepton's superuser token. */
async function leptonExport<T>(path: string): Promise<T> {
    if (!leptonToken) {
        throw new Error(`LEPTON_TOKEN must be set to fetch ${path}`);
    }
    const response = await fetch(`${leptonUrl}${path}`, {
        headers: { "X-Csrf-Token": leptonToken },
    });
    if (!response.ok) {
        throw new Error(`Lepton returned ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
}

async function restoreUsers(): Promise<void> {
    const users = await db
        .select({
            id: schema.user.id,
            email: schema.user.email,
            image: schema.user.image,
        })
        .from(schema.user);

    const candidates = users.flatMap((u) => {
        const key = u.image ? keyOf(u.image) : null;
        return key ? [{ ...u, key }] : [];
    });
    const live = await liveAssetKeys(candidates.map((c) => c.key));
    const broken = candidates.filter((c) => !live.has(c.key));

    console.log(
        `users: ${broken.length} broken image references (of ${candidates.length} hosted)`,
    );
    if (broken.length === 0) return;

    const exported = await leptonExport<{
        users: { user_id: string; email: string; image: string | null }[];
    }>("/migration/photon-user-export/");
    const sourceByEmail = new Map(
        exported.users
            .filter((u) => (u.image ?? "").trim())
            .map((u) => [u.email.trim().toLowerCase(), u.image!.trim()]),
    );

    let restored = 0;
    let unmatched = 0;
    let failed = 0;

    for (const user of broken) {
        const source = sourceByEmail.get(user.email.trim().toLowerCase());
        if (!source) {
            unmatched++;
            continue;
        }
        if (!commit) {
            restored++;
            continue;
        }

        const newUrl = await copyImage(
            source,
            `profile-${user.email.split("@")[0]}`,
            "profile-images",
        );
        if (!newUrl) {
            failed++;
            continue;
        }
        await db
            .update(schema.user)
            .set({ image: newUrl })
            .where(eq(schema.user.id, user.id));
        restored++;
        if (restored % 50 === 0) console.log(`  ${restored} restored…`);
    }

    console.log(
        `users: ${restored} restored, ${unmatched} without a Lepton match, ${failed} unreachable at source`,
    );
}

async function restoreFines(): Promise<void> {
    const fines = await db
        .select({ id: schema.fine.id, image: schema.fine.image })
        .from(schema.fine);

    const candidates = fines.flatMap((f) => {
        const key = f.image ? keyOf(f.image) : null;
        return key ? [{ ...f, key }] : [];
    });
    const live = await liveAssetKeys(candidates.map((c) => c.key));
    const broken = candidates.filter((c) => !live.has(c.key));

    console.log(
        `fines: ${broken.length} broken image references (of ${candidates.length} hosted)`,
    );
    if (broken.length === 0) return;

    // The table export pages by offset and serves rows as positional arrays
    // with a separate `columns` header; fines run to tens of thousands of rows.
    const leptonFines: { id: string; image: string | null }[] = [];
    for (let offset = 0; ; offset += 1000) {
        const payload = await leptonExport<{
            columns: string[];
            rows: unknown[][];
        }>(
            `/migration/photon-table-export/?table=group_fine&offset=${offset}&limit=1000`,
        );
        if (payload.rows.length === 0) break;

        const idAt = payload.columns.indexOf("id");
        const imageAt = payload.columns.indexOf("image");
        if (idAt < 0 || imageAt < 0) {
            throw new Error(
                `group_fine export lacks id/image columns: ${payload.columns.join(", ")}`,
            );
        }
        for (const row of payload.rows) {
            leptonFines.push({
                id: String(row[idAt]),
                image: (row[imageAt] as string | null) ?? null,
            });
        }
    }

    const sourceById = new Map(
        leptonFines
            .filter((f) => f.image && /^https?:\/\//.test(f.image.trim()))
            .map((f) => [char32ToUuid(f.id), f.image!.trim()]),
    );
    console.log(`  ${sourceById.size} Lepton fines carry an image`);

    let restored = 0;
    let unmatched = 0;
    let failed = 0;

    for (const fine of broken) {
        const source = sourceById.get(fine.id);
        if (!source) {
            unmatched++;
            continue;
        }
        if (!commit) {
            restored++;
            continue;
        }

        const newUrl = await copyImage(
            source,
            `fine-${fine.id.slice(0, 8)}`,
            "fine-images",
        );
        if (!newUrl) {
            failed++;
            continue;
        }
        await db
            .update(schema.fine)
            .set({ image: newUrl })
            .where(eq(schema.fine.id, fine.id));
        restored++;
        if (restored % 100 === 0) console.log(`  ${restored} restored…`);
    }

    console.log(
        `fines: ${restored} restored, ${unmatched} without a Lepton match, ${failed} unreachable at source`,
    );
}

if (wants("events")) await restoreEvents();
if (wants("groups")) await restoreGroups();
if (wants("users")) await restoreUsers();
if (wants("fines")) await restoreFines();

if (!commit) {
    console.log("\nDry run — nothing was written. Re-run with --commit.");
}
process.exit(0);
