/**
 * One-shot backfill: copy the files that event descriptions, news bodies and
 * fine texts embed from Lepton's Azure blob storage into our own bucket, and
 * rewrite the links in the text to the Photon asset route.
 *
 * Idempotent: keys are derived from the source filename, so a re-run
 * overwrites the same objects, and rewritten rows no longer match.
 *
 * Dry run by default. Run with:
 *   cd apps/api && bun run src/db/import-embedded-azure-files.ts [--commit]
 */
import { fetchWithTimeout } from "@photon/core/http";
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { eq, like } from "drizzle-orm";
import { env } from "~/lib/env";
import { createStorageClient } from "~/lib/storage";

const commit = process.argv.includes("--commit");

const AZURE_HOST = "blob.core.windows.net";
const AZURE_URL =
    /https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[^\s"')\]<>]+/g;

type Field = {
    label: string;
    prefix: string;
    text: string;
    save: (text: string) => Promise<void>;
};

function keyFor(prefix: string, sourceUrl: string): string {
    const filename = decodeURIComponent(
        new URL(sourceUrl).pathname.split("/").pop() ?? "",
    ).replace(/[^a-zA-Z0-9._-]+/g, "-");
    return `${prefix}/${filename}`;
}

async function main() {
    const db = createDb({
        connectionString: env.DATABASE_URL,
        timeouts: DISABLED_TIMEOUTS,
    });
    const bucket = await createStorageClient({ db });
    const pattern = `%${AZURE_HOST}%`;

    const events = await db
        .select({ id: schema.event.id, text: schema.event.description })
        .from(schema.event)
        .where(like(schema.event.description, pattern));
    const news = await db
        .select({ id: schema.news.id, text: schema.news.body })
        .from(schema.news)
        .where(like(schema.news.body, pattern));
    const fineReasons = await db
        .select({ id: schema.fine.id, text: schema.fine.reason })
        .from(schema.fine)
        .where(like(schema.fine.reason, pattern));
    const fineDefenses = await db
        .select({ id: schema.fine.id, text: schema.fine.defense })
        .from(schema.fine)
        .where(like(schema.fine.defense, pattern));

    const fields: Field[] = [
        ...events.map((row) => ({
            label: `event ${row.id} description`,
            prefix: "event-images",
            text: row.text ?? "",
            save: async (text: string) => {
                await db
                    .update(schema.event)
                    .set({ description: text })
                    .where(eq(schema.event.id, row.id));
            },
        })),
        ...news.map((row) => ({
            label: `news ${row.id} body`,
            prefix: "news-images",
            text: row.text,
            save: async (text: string) => {
                await db
                    .update(schema.news)
                    .set({ body: text })
                    .where(eq(schema.news.id, row.id));
            },
        })),
        ...fineReasons.map((row) => ({
            label: `fine ${row.id} reason`,
            prefix: "fine-text-images",
            text: row.text,
            save: async (text: string) => {
                await db
                    .update(schema.fine)
                    .set({ reason: text })
                    .where(eq(schema.fine.id, row.id));
            },
        })),
        ...fineDefenses.map((row) => ({
            label: `fine ${row.id} defense`,
            prefix: "fine-text-images",
            text: row.text ?? "",
            save: async (text: string) => {
                await db
                    .update(schema.fine)
                    .set({ defense: text })
                    .where(eq(schema.fine.id, row.id));
            },
        })),
    ];

    const sourceByKey = new Map<string, string>();
    for (const field of fields) {
        for (const sourceUrl of field.text.match(AZURE_URL) ?? []) {
            const key = keyFor(field.prefix, sourceUrl);
            const known = sourceByKey.get(key);
            if (known && known !== sourceUrl) {
                throw new Error(`Key collision on ${key}`);
            }
            sourceByKey.set(key, sourceUrl);
        }
    }

    console.log(`fields=${fields.length} files=${sourceByKey.size}`);
    if (!commit) {
        console.log("Dry run — pass --commit to copy and rewrite.");
        process.exit(0);
    }

    const copied = new Set<string>();
    let failedFiles = 0;

    for (const [key, sourceUrl] of sourceByKey) {
        try {
            const response = await fetchWithTimeout(sourceUrl, {
                timeoutMs: 120_000,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            await bucket.upload(key, buffer, {
                originalFilename: key.slice(key.lastIndexOf("/") + 1),
                contentType:
                    response.headers.get("content-type")?.split(";")[0] ??
                    undefined,
                visibility: "public",
            });
            // Promote so the staged-asset cleanup job never reaps the file.
            await bucket.promoteAsset(key);

            copied.add(sourceUrl);
            console.log(`✅ ${key} (${buffer.length} B)`);
        } catch (error) {
            failedFiles++;
            console.error(`❌ ${key}: ${sourceUrl}`, error);
        }
    }

    let rewritten = 0;
    let skipped = 0;

    for (const field of fields) {
        const sources = field.text.match(AZURE_URL) ?? [];
        // A half-rewritten text would still match on the next run, so a field
        // is only saved once every file it embeds has been copied.
        if (!sources.every((sourceUrl) => copied.has(sourceUrl))) {
            skipped++;
            console.error(`⏭️  ${field.label}: a file failed, left untouched`);
            continue;
        }

        await field.save(
            field.text.replace(
                AZURE_URL,
                (sourceUrl) =>
                    `${env.ROOT_URL}/api/assets/${keyFor(field.prefix, sourceUrl)}`,
            ),
        );
        rewritten++;
    }

    console.log(
        `\nDone. files=${copied.size} failedFiles=${failedFiles} rewritten=${rewritten} skipped=${skipped}`,
    );
    process.exit(failedFiles > 0 ? 1 : 0);
}

await main();
