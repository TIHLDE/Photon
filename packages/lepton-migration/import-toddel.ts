/**
 * Import the TÖDDEL archive from Lepton into Photon.
 *
 * Standalone rather than a phase of the main migration: an issue references no
 * users, groups or events, so it needs none of the in-memory id maps the other
 * phases share, and none of Lepton's MySQL either — the archive is public, so
 * it is read straight from Lepton's REST API.
 *
 * Reading live rather than from the SQL dump is deliberate. The dump under
 * `dumps/` stops at edition 19 while Lepton is on 23, so importing from it
 * would silently drop four issues and go further out of date with every term.
 *
 * The covers and PDFs live in Lepton's Azure blob storage, which goes away
 * when Lepton is retired, so each file is copied into Photon's own object
 * storage rather than linked. Copying goes through the same asset service the
 * upload endpoint uses, so keys, asset rows and URLs are indistinguishable
 * from a file uploaded through the site.
 *
 * Safe to re-run: `edition` is the primary key, and an issue whose asset
 * already points at Photon is left alone instead of being copied again. That
 * also makes this the way to pick up new issues later.
 *
 *   DATABASE_URL=... S3_...=... bun packages/lepton-migration/import-toddel.ts
 *   ... --commit    to actually write
 */
import { S3ObjectStorageService } from "@photon/core/services/storage";
import { schema } from "@photon/db";
import { drizzle } from "drizzle-orm/node-postgres";
import { DatabaseAssetStorageService } from "../../apps/api/src/lib/storage";

type LeptonIssue = {
    edition: number;
    title: string;
    image: string | null;
    pdf: string;
    published_at: string;
};

type SourceIssue = {
    edition: number;
    title: string;
    sourceImageUrl: string | null;
    sourcePdfUrl: string;
    publishedAt: string;
};

/**
 * Issues whose stored PDF url is wrong rather than whose file is missing.
 *
 * Both 404 from Lepton, which reads as "the archive has holes" — but the
 * blobs are still in Azure under a url the database never caught up with, and
 * this is the last chance to fetch them.
 *
 * - Edition 9 is recorded against `tihldestorage` while the file sits in
 *   `leptonstoragepro` under the same key.
 * - Edition 12 has two uuids concatenated in front of the filename; only the
 *   second one addresses a real blob.
 *
 * Both recovered files carry a PDF creation date matching their publication
 * (2023-03-25 for an issue published 2023-03-20; 2023-11-20 for 2023-11-24),
 * and edition 9's opens on its masthead, so they are the right documents.
 *
 * Edition 15 stays lost: both storage accounts, five filename spellings, five
 * containers, the cover's uuid and the Wayback Machine all come up empty.
 */
const RECOVERED_PDF_URLS = new Map<number, string>([
    [
        9,
        "https://leptonstoragepro.blob.core.windows.net/applicationpdf/763fa2f4-0be5-417d-99c7-b644ba4afdd2toddelh23v2_master.pdf",
    ],
    [
        12,
        "https://leptonstoragepro.blob.core.windows.net/applicationpdf/1bc5df5e-8173-419a-87a5-b1644d49bfb5toddelH23V2Digital%20%281%29.pdf",
    ],
]);

const commit = process.argv.includes("--commit");
const rootUrl = process.env.ROOT_URL ?? "https://photon.tihlde.org";
const leptonUrl =
    process.env.LEPTON_API_URL ??
    "https://api.tihlde.org/toddel/?page_size=100";

const leptonResponse = await fetch(leptonUrl);
if (!leptonResponse.ok) {
    throw new Error(
        `Lepton returned ${leptonResponse.status} for the TÖDDEL archive`,
    );
}

const payload = (await leptonResponse.json()) as {
    count?: number;
    results?: LeptonIssue[];
};
const leptonIssues = payload.results ?? [];

if (leptonIssues.length === 0) {
    throw new Error("Lepton returned no issues; refusing to run");
}

if (payload.count != null && payload.count !== leptonIssues.length) {
    // One page is assumed to hold the whole archive. Say so loudly rather than
    // importing a partial one if it ever outgrows the page size.
    throw new Error(
        `Lepton reports ${payload.count} issues but returned ${leptonIssues.length}; raise page_size`,
    );
}

const issues: SourceIssue[] = leptonIssues.map((issue) => ({
    edition: issue.edition,
    title: issue.title,
    sourceImageUrl: issue.image || null,
    sourcePdfUrl: RECOVERED_PDF_URLS.get(issue.edition) ?? issue.pdf,
    // Lepton stores edition 14 as `0024-04-19`. A four-digit year starting
    // "00" is a typo for the 2000s, not a date in antiquity.
    publishedAt: issue.published_at.startsWith("00")
        ? `20${issue.published_at.slice(2)}`
        : issue.published_at,
}));

console.log(`Found ${issues.length} issues in Lepton`);

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
