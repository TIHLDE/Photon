/**
 * Import the TÖDDEL archive from Lepton into Photon.
 *
 * Standalone rather than a phase of the main migration: an issue references no
 * users, groups or events, so it needs none of the in-memory id maps the other
 * phases share. It reads `data/toddel-issues.json`, extracted from the Lepton
 * dump, so it does not need MySQL access either.
 *
 * The covers and PDFs live in Lepton's Azure blob storage, which goes away
 * when Lepton is retired, so each file is copied into Photon's own object
 * storage rather than linked. Copying goes through the same asset service the
 * upload endpoint uses, so keys, asset rows and URLs are indistinguishable
 * from a file uploaded through the site.
 *
 * Safe to re-run: `edition` is the primary key, and an issue whose asset
 * already points at Photon is left alone instead of being copied again.
 *
 *   DATABASE_URL=... S3_...=... bun packages/lepton-migration/import-toddel.ts
 *   ... --commit    to actually write
 */
import { readFile } from "node:fs/promises";
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { schema } from "@photon/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseAssetStorageService } from "../../apps/api/src/lib/storage";

type SourceIssue = {
    edition: number;
    title: string;
    sourceImageUrl: string | null;
    sourcePdfUrl: string;
    publishedAt: string;
};

const commit = process.argv.includes("--commit");
const rootUrl = process.env.ROOT_URL ?? "https://photon.tihlde.org";

const issues: SourceIssue[] = JSON.parse(
    await readFile(
        new URL("./data/toddel-issues.json", import.meta.url),
        "utf8",
    ),
);

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

/** Copy one remote file into Photon's storage and return its public URL. */
async function copyToPhoton(
    sourceUrl: string,
    edition: number,
    kind: "cover" | "pdf",
): Promise<string | null> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
        console.warn(
            `  edition ${edition}: ${kind} unreachable (${response.status}) — ${sourceUrl}`,
        );
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
        response.headers.get("content-type") ??
        (kind === "pdf" ? "application/pdf" : "image/jpeg");
    // Lepton stored covers as both png and jpeg, so the extension follows what
    // was actually served rather than a guess that contradicts the bytes.
    const extension = contentType.split("/")[1]?.split(";")[0] ?? "bin";
    const filename = `toddel-${edition}-${kind}.${extension}`;
    const published = issues.find((i) => i.edition === edition)!.publishedAt;
    const key = `uploads/${published.slice(0, 4)}/${published.slice(5, 7)}/${crypto.randomUUID()}_${filename}`;

    if (!commit) {
        console.log(
            `  edition ${edition}: would copy ${kind} (${buffer.length} bytes)`,
        );
        return `${rootUrl}/api/assets/${key}`;
    }

    await bucket.upload(key, buffer, {
        originalFilename: filename,
        contentType,
        visibility: "public",
    });
    // Un-promoted assets are deleted by the cleanup cron after two days.
    await bucket.promoteAsset(key);

    return `${rootUrl}/api/assets/${key}`;
}

const existing = await db.query.toddel.findMany();
const alreadyOnPhoton = new Map(
    existing.map((issue) => [issue.edition, issue.pdfUrl.startsWith(rootUrl)]),
);

let copied = 0;
let skipped = 0;

for (const issue of issues.sort((a, b) => a.edition - b.edition)) {
    if (alreadyOnPhoton.get(issue.edition)) {
        skipped++;
        continue;
    }

    /**
     * The PDF goes first, and a failure abandons the issue before the cover is
     * touched. Copying both at once was tidier but left the cover behind as a
     * promoted, unreferenced asset whenever the PDF turned out to be missing —
     * and promoted assets are exactly the ones the cleanup cron will not
     * collect. Three of the archive's PDFs already 404, so this is not
     * hypothetical.
     */
    const pdfUrl = await copyToPhoton(issue.sourcePdfUrl, issue.edition, "pdf");

    if (!pdfUrl) {
        console.warn(`  edition ${issue.edition}: no PDF, skipping the issue`);
        continue;
    }

    const imageUrl = issue.sourceImageUrl
        ? await copyToPhoton(issue.sourceImageUrl, issue.edition, "cover")
        : null;

    if (commit) {
        await db
            .insert(schema.toddel)
            .values({
                edition: issue.edition,
                title: issue.title,
                imageUrl,
                pdfUrl,
                publishedAt: issue.publishedAt,
            })
            .onConflictDoUpdate({
                target: schema.toddel.edition,
                set: { title: issue.title, imageUrl, pdfUrl },
            });
    }

    copied++;
    console.log(`  edition ${issue.edition}: ${issue.title}`);
}

console.log(
    `\n${commit ? "Imported" : "Dry run"}: ${copied} issues, ${skipped} already on Photon`,
);
if (!commit) console.log("Re-run with --commit to write.");

process.exit(0);
