import type { DbSchema } from "@photon/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { StorageService } from "~/lib/storage";
import { assetKeyFromUrl, deleteAsset } from "./index";
import { findAssetReferences } from "./references";

type AssetContext = {
    db: NodePgDatabase<DbSchema>;
    bucket: StorageService;
};

/**
 * Slett assets ingen rad peker på lenger.
 *
 * Må kalles *etter* at raden er lagret eller slettet: referansesjekken leser
 * databasen, og en URL som fortsatt står i en annen rad skal overleve.
 *
 * Feiler aldri utad. Opprydningen er en bieffekt av et kall som allerede har
 * gjort jobben sin, og en filsletting som ikke gikk gjennom skal ikke gi
 * brukeren en feil på en endring som er lagret.
 */
export async function releaseAssetUrls(
    ctx: AssetContext,
    urls: (string | null | undefined)[],
): Promise<void> {
    const keys = [
        ...new Set(
            urls
                .map((url) => (url ? assetKeyFromUrl(url) : null))
                .filter((key): key is string => key !== null),
        ),
    ];
    if (keys.length === 0) return;

    try {
        const referenced = await findAssetReferences(ctx.db, keys);

        for (const key of keys) {
            if (referenced.has(key)) continue;
            await deleteAsset(ctx.bucket, key);
        }
    } catch (error) {
        console.error(
            `Failed to delete unreferenced assets ${keys.join(", ")}:`,
            error,
        );
    }
}

/**
 * Slett bildene en oppdatering erstatter.
 *
 * Hvert par er `[URL-en raden hadde, det kallet setter]`. `undefined` betyr at
 * kallet lar feltet stå, og da skal filen bli liggende.
 */
export async function releaseReplacedAssetUrls(
    ctx: AssetContext,
    pairs: [string | null, string | null | undefined][],
): Promise<void> {
    await releaseAssetUrls(
        ctx,
        pairs
            .filter(
                ([previous, next]) => next !== undefined && next !== previous,
            )
            .map(([previous]) => previous),
    );
}
