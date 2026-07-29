import sharp from "sharp";
import type { LoggerType } from "~/middleware/logger";

/**
 * Longest edge an uploaded image is allowed to keep. Anything larger is scaled
 * down — no surface on the site renders wider than this, so the extra pixels
 * only cost bandwidth.
 */
export const IMAGE_MAX_DIMENSION = 2560;

/**
 * WebP quality. 80 is the point where the format stops being visibly lossy for
 * photographic content while still cutting most of the bytes.
 */
export const IMAGE_WEBP_QUALITY = 80;

/**
 * MIME types we re-encode. GIF is deliberately excluded: it is the only allowed
 * image type that can be animated, and a naive re-encode would drop the
 * animation.
 */
const OPTIMIZABLE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

export function isOptimizableImage(contentType: string | undefined): boolean {
    return contentType !== undefined && OPTIMIZABLE_MIME_TYPES.has(contentType);
}

export type OptimizedImage = {
    buffer: Buffer;
    contentType: string;
    /** Filename with the extension swapped to match `contentType`. */
    filename: string;
    width: number;
    height: number;
};

/**
 * Re-encode an uploaded image to WebP, scaled to fit within
 * {@link IMAGE_MAX_DIMENSION} and stripped of metadata.
 *
 * Returns `null` when the input is not an optimizable image or when the
 * re-encode would not actually save bytes — callers then store the original.
 * Decoding failures are treated the same way: a file we cannot parse is a file
 * the uploader should get an error about from the storage layer, not one we
 * should reject here.
 */
export async function optimizeImage(
    buffer: Buffer,
    contentType: string | undefined,
    originalFilename: string,
    logger?: LoggerType,
): Promise<OptimizedImage | null> {
    if (!isOptimizableImage(contentType)) {
        return null;
    }

    try {
        const optimized = await sharp(buffer, { failOn: "none" })
            // Bake EXIF orientation into the pixels before we strip metadata,
            // otherwise portrait phone photos come out sideways.
            .rotate()
            .resize({
                width: IMAGE_MAX_DIMENSION,
                height: IMAGE_MAX_DIMENSION,
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: IMAGE_WEBP_QUALITY })
            .toBuffer({ resolveWithObject: true });

        // Small, already-optimized images can grow when re-encoded. Keeping the
        // original is strictly better for those.
        if (optimized.data.length >= buffer.length) {
            return null;
        }

        return {
            buffer: optimized.data,
            contentType: "image/webp",
            filename: replaceExtension(originalFilename, "webp"),
            width: optimized.info.width,
            height: optimized.info.height,
        };
    } catch (error) {
        logger?.warn(
            { err: error, originalFilename, contentType },
            "Image optimization failed, storing original",
        );
        return null;
    }
}

/** Swap a filename's extension, appending one when it has none. */
export function replaceExtension(filename: string, extension: string): string {
    const dot = filename.lastIndexOf(".");
    const base = dot > 0 ? filename.slice(0, dot) : filename;
    return `${base}.${extension}`;
}
