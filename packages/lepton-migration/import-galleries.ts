/**
 * Import the photo galleries from Lepton into Photon.
 *
 * Standalone like import-news-jobs: `GET /galleries/` and
 * `GET /galleries/{id}/pictures/` are public in Lepton's REST API, so this
 * needs no MySQL access and no export token.
 *
 * Every picture lives in Lepton's Azure blob storage, which disappears when
 * Lepton is retired, so each image is copied into Photon's own object storage
 * through the same asset service the upload endpoint uses. A picture whose
 * image cannot be fetched is skipped rather than stored as a dead link — a
 * gallery of broken images is worse than a gallery with a few gaps.
 *
 * Albums carry an optional `event` in Lepton. Nothing in the current data set
 * uses it, but the field is mapped anyway (Lepton event id → Photon event via
 * the event's Lepton-derived slug) so a later re-run picks up any that appear.
 *
 * Safe to re-run: an album is recognised by its slug, and a picture by the
 * Lepton image URL it came from, recorded in `imageAlt`-adjacent bookkeeping —
 * see `leptonSourceKey`. Re-running only adds what is missing.
 *
 *   DATABASE_URL=... S3_...=... bun packages/lepton-migration/import-galleries.ts
 *   ... --commit           to actually write
 *   ... --album=<slug>     to import a single album
 */
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseAssetStorageService } from "../../apps/api/src/lib/storage";

type LeptonAlbum = {
    id: string;
    title: string;
    slug: string;
    description: string;
    image: string | null;
    image_alt: string;
    event: number | null;
};

type LeptonPicture = {
    id: string;
    image: string;
    title: string;
    image_alt: string;
    description: string;
    created_at: string;
    updated_at: string;
};

const commit = process.argv.includes("--commit");
const onlyAlbum = process.argv
    .find((a) => a.startsWith("--album="))
    ?.slice("--album=".length);
const rootUrl = process.env.ROOT_URL ?? "https://photon.tihlde.org";
const leptonUrl = process.env.LEPTON_API_URL ?? "https://api.tihlde.org";

/** Walk Lepton's numbered pagination and return every result. */
async function fetchAllPages<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let page: number | null = 1;
    let expected: number | null = null;

    while (page != null) {
        const response = await fetch(
            `${leptonUrl}${path}${path.includes("?") ? "&" : "?"}page=${page}`,
        );
        if (!response.ok) {
            throw new Error(`Lepton returned ${response.status} for ${path}`);
        }
        const payload = (await response.json()) as {
            count: number;
            next: number | null;
            results: T[];
        };
        expected = payload.count;
        results.push(...payload.results);
        page = payload.next;
    }

    if (expected != null && results.length !== expected) {
        throw new Error(
            `Lepton reports ${expected} rows for ${path} but paging returned ${results.length}`,
        );
    }
    return results;
}

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

/**
 * Copy one remote image into Photon's storage and return its public URL.
 *
 * A dry run only probes with HEAD — downloading several thousand full-size
 * photos to then throw the bytes away turns a preview into a half-hour job,
 * while HEAD still catches the images that have gone missing.
 */
async function copyImage(
    sourceUrl: string,
    label: string,
    createdAt: string,
): Promise<string | null> {
    let response: Response;
    try {
        response = await fetch(sourceUrl, {
            method: commit ? "GET" : "HEAD",
        });
    } catch {
        console.warn(`  ${label}: image host unreachable — ${sourceUrl}`);
        return null;
    }
    if (!response.ok) {
        console.warn(
            `  ${label}: image unreachable (${response.status}) — ${sourceUrl}`,
        );
        return null;
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const extension = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filename = `${label}.${extension}`;
    const key = `uploads/${createdAt.slice(0, 4)}/${createdAt.slice(5, 7)}/${crypto.randomUUID()}_${filename}`;

    if (!commit) {
        return `${rootUrl}/api/assets/${key}`;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    await bucket.upload(key, buffer, {
        originalFilename: filename,
        contentType,
        visibility: "public",
    });
    // Un-promoted assets are deleted by the cleanup cron after two days.
    await bucket.promoteAsset(key);

    return `${rootUrl}/api/assets/${key}`;
}

/**
 * How a picture is recognised on a second run.
 *
 * The copied image gets a fresh Photon URL, so that cannot identify it. The
 * Lepton blob URL is stable and unique per upload, and is stored on the row as
 * `sourceUrl` precisely so re-running this script is a no-op.
 */
const leptonSourceKey = (imageUrl: string): string => imageUrl.trim();

async function importGalleries(): Promise<void> {
    const albums = await fetchAllPages<LeptonAlbum>("/galleries/");
    const targets = onlyAlbum
        ? albums.filter((a) => a.slug === onlyAlbum)
        : albums;

    console.log(`Found ${albums.length} albums in Lepton`);
    if (onlyAlbum) console.log(`Importing only "${onlyAlbum}"`);

    const existingAlbums = await db.query.galleryAlbum.findMany({
        columns: { id: true, slug: true },
    });
    const albumBySlug = new Map(existingAlbums.map((a) => [a.slug, a.id]));

    // Lepton's album ids are UUIDs and its event links are integers, so an
    // event can only be resolved through data already migrated. Nothing in
    // the current export sets it; warn rather than guess if that changes.
    let unresolvedEvents = 0;

    let importedAlbums = 0;
    let importedPictures = 0;
    let skippedPictures = 0;
    let failedPictures = 0;

    for (const album of targets) {
        const pictures = await fetchAllPages<LeptonPicture>(
            `/galleries/${album.id}/pictures/`,
        );

        let albumId = albumBySlug.get(album.slug);

        if (!albumId) {
            const coverUrl = album.image
                ? await copyImage(
                      album.image,
                      `gallery-${album.slug}-cover`,
                      new Date().toISOString(),
                  )
                : null;

            if (album.event != null) unresolvedEvents++;

            if (commit) {
                const [inserted] = await db
                    .insert(schema.galleryAlbum)
                    .values({
                        slug: album.slug.slice(0, 80),
                        title: album.title.slice(0, 100),
                        description: album.description || null,
                        imageUrl: coverUrl,
                        imageAlt: album.image_alt?.slice(0, 200) || null,
                    })
                    .returning({ id: schema.galleryAlbum.id });
                albumId = inserted?.id;
            }

            importedAlbums++;
            console.log(
                `  album ${album.slug}: ${album.title} (${pictures.length} pictures)`,
            );
        } else {
            console.log(
                `  album ${album.slug}: already on Photon, checking pictures`,
            );
        }

        // Pictures already imported are recognised by the Lepton URL kept in
        // `sourceUrl`; without an album row (dry run) there is nothing to
        // compare against.
        const existingSources = new Set<string>();
        if (albumId) {
            const existingPictures = await db.query.galleryPicture.findMany({
                where: eq(schema.galleryPicture.albumId, albumId),
                columns: { sourceUrl: true },
            });
            for (const p of existingPictures) {
                if (p.sourceUrl)
                    existingSources.add(leptonSourceKey(p.sourceUrl));
            }
        }

        // Built without albumId: on a dry run there is no album row yet, and
        // inventing a placeholder id would be a lie waiting to be inserted.
        const rows: Omit<
            typeof schema.galleryPicture.$inferInsert,
            "albumId"
        >[] = [];

        for (const picture of pictures) {
            if (existingSources.has(leptonSourceKey(picture.image))) {
                skippedPictures++;
                continue;
            }

            const imageUrl = await copyImage(
                picture.image,
                `gallery-${album.slug}-${picture.id.slice(0, 8)}`,
                picture.created_at,
            );

            if (!imageUrl) {
                failedPictures++;
                continue;
            }

            rows.push({
                imageUrl,
                sourceUrl: picture.image,
                imageAlt: picture.image_alt?.slice(0, 200) || null,
                title: picture.title?.slice(0, 100) || null,
                description: picture.description || null,
                createdAt: new Date(picture.created_at),
                updatedAt: new Date(picture.updated_at),
            });
            importedPictures++;
        }

        if (commit && albumId && rows.length > 0) {
            // Chunked: some albums run to several hundred pictures.
            for (let i = 0; i < rows.length; i += 200) {
                await db
                    .insert(schema.galleryPicture)
                    .values(
                        rows
                            .slice(i, i + 200)
                            .map((row) => ({ ...row, albumId })),
                    );
            }

            // An album imported without a cover adopts its first picture, the
            // same fallback the API applies when pictures are uploaded.
            const [current] = await db
                .select({ imageUrl: schema.galleryAlbum.imageUrl })
                .from(schema.galleryAlbum)
                .where(eq(schema.galleryAlbum.id, albumId));

            if (!current?.imageUrl && rows[0]) {
                await db
                    .update(schema.galleryAlbum)
                    .set({ imageUrl: rows[0].imageUrl })
                    .where(eq(schema.galleryAlbum.id, albumId));
            }
        }
    }

    console.log(
        `\n${commit ? "Imported" : "Dry run"}: ${importedAlbums} albums, ${importedPictures} pictures` +
            (skippedPictures ? `, ${skippedPictures} already on Photon` : "") +
            (failedPictures ? `, ${failedPictures} images unreachable` : "") +
            (unresolvedEvents
                ? `, ${unresolvedEvents} albums had an event link that could not be resolved`
                : ""),
    );

    if (!commit) {
        console.log("Nothing was written — re-run with --commit.");
    }
}

await importGalleries();
process.exit(0);
