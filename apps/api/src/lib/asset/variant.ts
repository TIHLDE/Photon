import type { StorageService } from "~/lib/storage";
import type { LoggerType } from "~/middleware/logger";
import { type ImageVariantWidth, imageVariantKey, resizeImage } from "./image";

/**
 * The image stored under `key`, re-encoded at `width`.
 *
 * Generated on the first request and kept, so only that request pays for the
 * re-encode. When the original cannot be re-encoded (sharp is unavailable, or
 * the bytes are not an image it can read) the original itself is returned,
 * with `resized: false`: it is still a correct answer, just a heavier one, and
 * the caller must not have to fetch it a second time to serve it.
 */
export async function getImageVariant(
    bucket: StorageService,
    key: string,
    width: ImageVariantWidth,
    logger?: LoggerType,
): Promise<{ body: Buffer; resized: boolean }> {
    const variantKey = imageVariantKey(key, width);

    const cached = await bucket.getObject(variantKey);
    if (cached) return { body: cached, resized: true };

    const original = await bucket.download(key);
    const variant = await resizeImage(original, width, logger);
    if (!variant) return { body: original, resized: false };

    // A failure to cache is not worth failing the response over — the next
    // request simply regenerates.
    await bucket
        .putObject(variantKey, variant, "image/webp")
        .catch((error: unknown) => {
            logger?.warn(
                { err: error, variantKey },
                "Could not cache image variant",
            );
        });

    return { body: variant, resized: true };
}
