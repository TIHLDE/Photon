import type Sharp from "sharp";
import type { LoggerType } from "~/middleware/logger";

/**
 * Resolved sharp module, or `null` once we know it cannot be loaded here.
 * `undefined` means we have not tried yet.
 */
let sharpModule: typeof Sharp | null | undefined;

/**
 * Load sharp on first use instead of at import time.
 *
 * sharp ships its codec as a platform-specific binary, and when that binary
 * does not match the host it throws on import. As a static import that killed
 * the entire API at boot: this module is pulled in by the asset upload route,
 * so a failure to load an image optimizer took down authentication, events and
 * everything else with it — which is exactly what happened in production on
 * 2026-07-29.
 *
 * Optimization is a nice-to-have; serving the site is not. Resolving it lazily
 * confines the blast radius to uploads, which already fall back to storing the
 * original whenever re-encoding fails.
 *
 * Lazy is not enough on its own: `bun build` inlines this import unless sharp is
 * marked external, and inlined sharp resolves its own platform package
 * (`@img/sharp-*`) from the bundle's directory, where it does not exist. That is
 * why the API's build script passes `--external sharp` — without it this catch
 * fires on every upload and images are stored unoptimized, silently. It did
 * exactly that in production from late July until 2026-08-14.
 */
async function loadSharp(logger?: LoggerType): Promise<typeof Sharp | null> {
    if (sharpModule !== undefined) {
        return sharpModule;
    }

    try {
        sharpModule = (await import("sharp")).default;
    } catch (error) {
        sharpModule = null;
        logger?.error(
            { err: error },
            "sharp could not be loaded; uploads will be stored without optimization",
        );
    }

    return sharpModule;
}

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

    const sharp = await loadSharp(logger);
    if (!sharp) {
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

/**
 * Widths a caller may ask for through `GET /api/assets/:key?w=`.
 *
 * An allowlist rather than an arbitrary number: every distinct width is a
 * separate re-encode and a separate stored object, so a free-form parameter
 * would let anyone fill the bucket and pin the CPU with `?w=1`, `?w=2`, …
 *
 * The values cover the surfaces the site actually renders — avatars and group
 * logos (160), card thumbnails (320/480), list rows and gallery columns
 * (640/960), detail heroes (1280) and the gallery lightbox (1920) — each also
 * serving as the 2x source for the width below it.
 */
export const IMAGE_VARIANT_WIDTHS = [
    160, 320, 480, 640, 960, 1280, 1920,
] as const;

export type ImageVariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

export function isImageVariantWidth(width: number): width is ImageVariantWidth {
    return (IMAGE_VARIANT_WIDTHS as readonly number[]).includes(width);
}

/**
 * Quality for generated variants. Lower than {@link IMAGE_WEBP_QUALITY}: a
 * variant is always displayed smaller than the original, and downscaling hides
 * compression artefacts that would be visible at full size.
 */
export const IMAGE_VARIANT_WEBP_QUALITY = 72;

/**
 * Storage key a generated variant is cached under.
 *
 * Kept under its own prefix so variants are never mistaken for uploads: they
 * carry no `asset` row, which means the staged-asset cleanup job cannot see
 * them and the open download route cannot address them directly.
 */
export function imageVariantKey(key: string, width: ImageVariantWidth): string {
    //
    // TODO: REMOVE THIS IF ONCE DRIFT SERVERS IS UP
    //
    if (key.startsWith("r2/")) {
        return `r2/derivatives/w${width}/${key.slice("r2/".length)}.webp`;
    }

    return `derivatives/w${width}/${key}.webp`;
}

/**
 * Re-encode an image to WebP at `width`, keeping its aspect ratio.
 *
 * Images narrower than `width` are returned at their own size rather than
 * upscaled, so asking for a variant is never worse than serving the original.
 * Returns `null` when sharp is unavailable or the input cannot be decoded —
 * callers then fall back to the original bytes.
 */
export async function resizeImage(
    buffer: Buffer,
    width: ImageVariantWidth,
    logger?: LoggerType,
): Promise<Buffer | null> {
    const sharp = await loadSharp(logger);
    if (!sharp) {
        return null;
    }

    try {
        return await sharp(buffer, { failOn: "none" })
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: IMAGE_VARIANT_WEBP_QUALITY })
            .toBuffer();
    } catch (error) {
        logger?.warn({ err: error, width }, "Image resize failed");
        return null;
    }
}

/** Swap a filename's extension, appending one when it has none. */
export function replaceExtension(filename: string, extension: string): string {
    const dot = filename.lastIndexOf(".");
    const base = dot > 0 ? filename.slice(0, dot) : filename;
    return `${base}.${extension}`;
}
