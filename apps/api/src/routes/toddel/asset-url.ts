import { env } from "@photon/core/env";
import { HTTPAppException } from "~/lib/errors";
import type { StorageService } from "~/lib/storage";

/**
 * Turn an uploaded asset key into the public URL the archive stores, and
 * promote the asset so the two-day staging cleanup leaves it alone.
 *
 * The URL is absolute and built from ROOT_URL because that is the shape every
 * row imported from Lepton already has; the frontend links straight to it.
 */
export async function publishAsset(
    bucket: StorageService,
    key: string,
): Promise<string> {
    const asset = await bucket.getAsset(key);

    if (!asset) {
        throw HTTPAppException.BadRequest(
            `No uploaded file with key '${key}'. Upload it via POST /api/assets first.`,
        );
    }

    await bucket.promoteAsset(key);

    return `${env.ROOT_URL}/api/assets/${key}`;
}
