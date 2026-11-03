import { env } from "@photon/core/env";
import { assetKeyFromUrl, isAssetUploader } from "~/lib/asset";
import { HTTPAppException } from "~/lib/errors";
import type { StorageService } from "~/lib/storage";

/**
 * Turn an uploaded asset key into the public URL the archive stores, and
 * promote the asset so the two-day staging cleanup leaves it alone.
 *
 * Promoting is what makes a key dangerous, so it takes the caller's own upload
 * or a file the issue already holds. A missing key answers the same as someone
 * else's, so this does not confirm which keys exist.
 *
 * The URL is absolute and built from ROOT_URL because that is the shape every
 * row imported from Lepton already has; the frontend links straight to it.
 */
export async function publishAsset(
    bucket: StorageService,
    callerId: string,
    key: string,
    heldByRow: (string | null)[] = [],
): Promise<string> {
    const asset = await bucket.getAsset(key);
    const held = heldByRow.some((url) => url && assetKeyFromUrl(url) === key);

    if (!asset || (!held && !isAssetUploader(asset, callerId))) {
        throw HTTPAppException.Forbidden(
            "Du kan bare bruke filer du selv har lastet opp.",
        );
    }

    await bucket.promoteAsset(key);

    return `${env.ROOT_URL}/api/assets/${key}`;
}
