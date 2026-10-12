import type { StorageService } from "~/lib/storage";
import type { LoggerType } from "~/middleware/logger";
import { type ImageVariantWidth, imageVariantKey, resizeImage } from "./image";

/**
 * The image stored under `key`, re-encoded at `width`.
 *
 * Generated on the first request and kept, so only that request pays for the
 * re-encode. Returns null when the original cannot be re-encoded (sharp is
 * unavailable, or the bytes are not an image it can read): the original is
 * then still a correct answer for the caller to serve, just a heavier one.
 */
export async function getImageVariant(
    bucket: StorageService,
    key: string,
    width: ImageVariantWidth,
    logger?: LoggerType,
): Promise<Buffer | null> {
    const variantKey = imageVariantKey(key, width);

    const cached = await bucket.getObject(variantKey);
    if (cached) return cached;

    const variant = await resizeImage(
        await bucket.download(key),
        width,
        logger,
    );
    if (!variant) return null;

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

    return variant;
}
