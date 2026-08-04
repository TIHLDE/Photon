import { schema } from "@photon/db";
import { eq, getTableName, is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
    ASSET_REFERENCE_COLUMNS,
    NON_ASSET_COLUMNS,
} from "~/lib/asset/references";
import { runAssetCleanup } from "~/lib/asset/worker";
import { integrationTest } from "~/test/config/integration";

/**
 * Column names that might hold an uploaded file. Anything matching has to be
 * classified — either it references an asset and the cleanup job must know
 * about it, or it is something else and says so in NON_ASSET_COLUMNS.
 */
const SUSPICIOUS = /(^|_)(url|uri|uris|image|logo|photo|avatar|file|pdf|key)$/;

describe("asset reference registry", () => {
    it("classifies every column that could hold an uploaded file", () => {
        const registered = new Set(ASSET_REFERENCE_COLUMNS.map((r) => r.label));
        const unclassified: string[] = [];

        for (const value of Object.values(schema)) {
            if (!is(value, PgTable)) continue;

            for (const column of getTableConfig(value).columns) {
                const label = `${getTableName(value)}.${column.name}`;
                if (!SUSPICIOUS.test(column.name)) continue;
                if (registered.has(label)) continue;
                if (label in NON_ASSET_COLUMNS) continue;
                unclassified.push(label);
            }
        }

        // A new column here means: add it to ASSET_REFERENCE_COLUMNS if it can
        // hold an uploaded file, or to NON_ASSET_COLUMNS with a reason if not.
        expect(unclassified).toEqual([]);
    });

    it("lists no column that has since been renamed or dropped", () => {
        const existing = new Set<string>();

        for (const value of Object.values(schema)) {
            if (!is(value, PgTable)) continue;
            for (const column of getTableConfig(value).columns) {
                existing.add(`${getTableName(value)}.${column.name}`);
            }
        }

        const stale = [
            ...ASSET_REFERENCE_COLUMNS.map((r) => r.label),
            ...Object.keys(NON_ASSET_COLUMNS),
        ].filter((label) => !existing.has(label));

        expect(stale).toEqual([]);
    });
});

describe("staged asset cleanup", () => {
    integrationTest(
        "rescues a staged asset a row still points at instead of deleting it",
        async ({ ctx }) => {
            const { db, bucket } = ctx;

            const author = await ctx.utils.createTestUser();

            const key = "uploads/2026/01/orphaned-news-image.png";
            await bucket.upload(key, Buffer.from("news picture"), {
                originalFilename: "news.png",
                contentType: "image/png",
                uploadedById: author.id,
            });

            // A route that forgot to promote: the row points at the asset, but
            // the asset is still staged and now older than the two-day window.
            await db.insert(schema.news).values({
                title: "Forgot to promote",
                header: "…",
                body: "…",
                imageUrl: `https://photon.tihlde.org/api/assets/${key}`,
                createdById: author.id,
            });

            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            await db
                .update(schema.asset)
                .set({ createdAt: threeDaysAgo })
                .where(eq(schema.asset.key, key));

            const result = await runAssetCleanup(ctx);

            expect(result.rescued).toBe(1);
            expect(result.deleted).toBe(0);

            // The file survives, and is now permanent.
            expect(await bucket.exists(key)).toBe(true);
            expect((await bucket.getAsset(key))?.status).toBe("ready");
        },
        600_000,
    );

    integrationTest(
        "still deletes a staged asset nothing points at",
        async ({ ctx }) => {
            const { db, bucket } = ctx;

            const key = "uploads/2026/01/nobody-wants-me.png";
            await bucket.upload(key, Buffer.from("unclaimed"), {
                originalFilename: "unclaimed.png",
                contentType: "image/png",
            });

            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            await db
                .update(schema.asset)
                .set({ createdAt: threeDaysAgo })
                .where(eq(schema.asset.key, key));

            const result = await runAssetCleanup(ctx);

            expect(result.deleted).toBeGreaterThanOrEqual(1);
            expect(await bucket.exists(key)).toBe(false);
            expect(await bucket.getAsset(key)).toBeNull();
        },
        600_000,
    );
});
