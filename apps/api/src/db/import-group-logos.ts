/**
 * One-shot backfill: copy group logos from Lepton's Azure blob storage into
 * our own S3/MinIO bucket and rewrite `org_group.image_url` to point at the
 * Photon asset route (`/api/assets/...`).
 *
 * Idempotent: groups whose image_url already points at `/api/assets/` are
 * skipped, and re-runs overwrite the same keys.
 *
 * Run with:
 *   cd apps/api && bun run src/db/import-group-logos.ts
 */
import { DISABLED_TIMEOUTS, createDb, schema } from "@photon/db";
import { eq, isNotNull } from "drizzle-orm";
import { env } from "~/lib/env";
import { createStorageClient } from "~/lib/storage";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
};

function extensionFor(contentType: string | null, url: string): string {
    if (contentType && EXTENSION_BY_CONTENT_TYPE[contentType]) {
        return EXTENSION_BY_CONTENT_TYPE[contentType];
    }
    const pathExt = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (pathExt && ["png", "jpg", "jpeg", "gif", "webp"].includes(pathExt)) {
        return pathExt === "jpeg" ? "jpg" : pathExt;
    }
    return "png";
}

async function main() {
    const db = createDb({
        connectionString: env.DATABASE_URL,
        timeouts: DISABLED_TIMEOUTS,
    });
    const bucket = await createStorageClient({ db });

    const groups = await db.query.group.findMany({
        where: isNotNull(schema.group.logoUrl),
    });

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const group of groups) {
        const sourceUrl = group.logoUrl;
        if (!sourceUrl) continue;

        if (sourceUrl.includes("/api/assets/")) {
            skipped++;
            continue;
        }

        try {
            const response = await fetch(sourceUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            const buffer = Buffer.from(await response.arrayBuffer());
            const ext = extensionFor(contentType, sourceUrl);
            const key = `group-logos/${group.slug}.${ext}`;

            await bucket.upload(key, buffer, {
                originalFilename: `${group.slug}.${ext}`,
                contentType:
                    contentType ?? `image/${ext === "jpg" ? "jpeg" : ext}`,
                visibility: "public",
            });
            // Promote so the staged-asset cleanup job never reaps the logo.
            await bucket.promoteAsset(key);

            const newUrl = `${env.ROOT_URL}/api/assets/${key}`;
            await db
                .update(schema.group)
                .set({ logoUrl: newUrl })
                .where(eq(schema.group.slug, group.slug));

            imported++;
            console.log(`✅ ${group.slug} → ${newUrl} (${buffer.length} B)`);
        } catch (error) {
            failed++;
            console.error(`❌ ${group.slug}: ${sourceUrl}`, error);
        }
    }

    console.log(
        `\nDone. imported=${imported} skipped=${skipped} failed=${failed}`,
    );
    process.exit(failed > 0 ? 1 : 0);
}

await main();
