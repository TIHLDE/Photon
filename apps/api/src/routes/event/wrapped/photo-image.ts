import { type ImageVariantWidth, isOptimizableImage } from "~/lib/asset/image";
import { getImageVariant } from "~/lib/asset/variant";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import type { LoggerType } from "~/middleware/logger";

/**
 * The bytes of a wrapped photo, with the headers that keep it private and
 * inert. Shared by the organizer's image route and the member's own.
 */
export async function photoImageResponse(
    bucket: AppContext["bucket"],
    logger: LoggerType,
    assetKey: string | undefined,
    w: string | undefined,
    logContext: { eventId: string; photoId: string },
): Promise<Response> {
    const asset = assetKey && (await bucket.getAsset(assetKey));
    if (!asset) {
        throw HTTPAppException.NotFound("Photo");
    }

    const isImage =
        asset.contentType !== null && isOptimizableImage(asset.contentType);

    let body: Buffer;
    let resized = false;
    try {
        // A variant is cached under a key that has no asset row, so the open
        // asset route cannot serve it either. `deleteAsset` removes variants
        // along with the original, which is why deleting a wrapped photo must
        // go through it and never the bucket directly.
        if (w && isImage) {
            ({ body, resized } = await getImageVariant(
                bucket,
                asset.key,
                Number(w) as ImageVariantWidth,
                logger,
            ));
        } else {
            body = await bucket.download(asset.key);
        }
    } catch (error) {
        logger.error(
            { err: error, ...logContext },
            "Wrapped photo has a row but no stored file",
        );
        throw HTTPAppException.NotFound("Photo");
    }

    // Uploads are limited to these types already; checked again here so a
    // row pointed at anything else can never be served as something a
    // browser would render or run.
    const contentType = resized
        ? "image/webp"
        : isImage && asset.contentType
          ? asset.contentType
          : "application/octet-stream";

    return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Content-Length": body.length.toString(),
            // `private` keeps nginx and any CDN from handing the photo to
            // someone else; `no-store` because access can end, and the photo
            // may be deleted, long before a cache would notice.
            "Cache-Control": "private, no-store",
        },
    });
}
