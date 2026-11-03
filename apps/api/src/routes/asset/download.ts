import {
    IMAGE_VARIANT_WIDTHS,
    type ImageVariantWidth,
    imageVariantKey,
    isImageQueueFull,
    isImageVariantWidth,
    isOptimizableImage,
    resizeImage,
    withImageSlot,
} from "~/lib/asset/image";
import { takeFromWindow } from "~/lib/asset/limits";
import { isMemberReadableAsset } from "~/lib/asset/member-readable";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import type { LoggerType } from "~/middleware/logger";

const VARIANT_WINDOW_SECONDS = 60 * 60;

/**
 * Twice the number of widths: enough for every width of an asset to be encoded
 * and then some, but an asset whose variant keeps failing to reach the bucket
 * stops being decoded again on every request.
 */
const VARIANTS_PER_ASSET_PER_HOUR = IMAGE_VARIANT_WIDTHS.length * 2;

/**
 * Anyone can ask for a variant and each one stored is an object against the
 * bucket's quota. Normal traffic stays far below this. A sweep over every asset
 * and width hits it and gets originals instead of filling the bucket overnight.
 */
const VARIANTS_PER_HOUR = 1000;

const variantsInFlight = new Map<string, Promise<Buffer | null>>();

async function mayEncodeVariant(
    { cache }: AppContext,
    key: string,
    logger?: LoggerType,
): Promise<boolean> {
    if (isImageQueueFull()) {
        return false;
    }

    return (
        (await takeFromWindow(
            cache,
            {
                name: `asset-variant:${key}`,
                limit: VARIANTS_PER_ASSET_PER_HOUR,
                seconds: VARIANT_WINDOW_SECONDS,
            },
            logger,
        )) &&
        (await takeFromWindow(
            cache,
            {
                name: "asset-variant:all",
                limit: VARIANTS_PER_HOUR,
                seconds: VARIANT_WINDOW_SECONDS,
            },
            logger,
        ))
    );
}

async function encodeVariant(
    ctx: AppContext,
    key: string,
    width: ImageVariantWidth,
    variantKey: string,
    store: boolean,
    logger?: LoggerType,
): Promise<Buffer | null> {
    if (!(await mayEncodeVariant(ctx, key, logger))) {
        return null;
    }

    const variant = await withImageSlot(async () =>
        resizeImage(await ctx.bucket.download(key), width, logger),
    );

    if (variant && store) {
        // A failure to cache is not worth failing the response over — the next
        // request simply regenerates.
        await ctx.bucket
            .putObject(variantKey, variant, "image/webp")
            .catch((error: unknown) => {
                logger?.warn(
                    { err: error, variantKey },
                    "Could not cache image variant",
                );
            });
    }

    return variant;
}

/** Requests for a variant being encoded right now share that one encode. */
function encodeVariantOnce(
    ctx: AppContext,
    key: string,
    width: ImageVariantWidth,
    variantKey: string,
    store: boolean,
    logger?: LoggerType,
): Promise<Buffer | null> {
    const running = variantsInFlight.get(variantKey);
    if (running) {
        return running;
    }

    const encoding = encodeVariant(
        ctx,
        key,
        width,
        variantKey,
        store,
        logger,
    ).finally(() => variantsInFlight.delete(variantKey));
    variantsInFlight.set(variantKey, encoding);
    return encoding;
}

export const downloadRoute = route().get(
    "/:key{.+}",
    describeRoute({
        tags: ["assets"],
        summary: "Download a file",
        operationId: "downloadAsset",
        description: `Download a file by its key.

The key is the full path returned when uploading, e.g., \`uploads/2024/01/uuid_filename.jpg\`

Most assets — nyhets- og arrangementsbilder, gruppelogoer, Töddel — need no
authentication. Galleribilder og profilbilder do: they answer 404 unless the
request carries a session. Contract signatures, application attachments and
fine pictures are never served here at all; they are only reachable through
routes that perform their own authorization.

**Resized variants:**
Pass \`?w=\` with one of ${IMAGE_VARIANT_WIDTHS.join(", ")} to get the image
re-encoded as WebP at that width, keeping its aspect ratio and never upscaling.
Variants are generated on first request and cached, so a card never has to
download a full-resolution original. Any other width is rejected, and the
parameter is ignored for non-image assets (PDF, GIF). Under heavy load, or when
the image cannot be re-encoded, the original is served with \`no-store\` instead.
Variants of a staged asset are not cached until it is promoted.`,
    })
        .response({
            statusCode: 200,
            description: "File content with appropriate Content-Type header",
        })
        .badRequest({ description: "Unsupported width" })
        .notFound({ description: "Asset not found" })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { bucket } = ctx;
        const key = c.req.param("key");

        const widthParam = c.req.query("w");
        let width: ImageVariantWidth | undefined;
        if (widthParam !== undefined) {
            const parsed = Number(widthParam);
            if (!isImageVariantWidth(parsed)) {
                throw HTTPAppException.BadRequest(
                    `Unsupported width '${widthParam}'. Allowed widths: ${IMAGE_VARIANT_WIDTHS.join(", ")}`,
                );
            }
            width = parsed;
        }

        // Check if asset exists in database
        const asset = await bucket.getAsset(key);

        if (!asset) {
            throw HTTPAppException.NotFound("Asset");
        }

        // Galleribilder og profilbilder er lesbare for enhver innlogget
        // bruker; resten av de private hører til en rute som autoriserer den
        // enkelte kalleren. 404 framfor 403, så ruta ikke bekrefter hvilke
        // nøkler som finnes.
        const needsSession = asset.visibility === "private";
        if (needsSession) {
            const signedIn = c.get("user") !== undefined;
            if (!signedIn || !(await isMemberReadableAsset(ctx, key))) {
                throw HTTPAppException.NotFound("Asset");
            }
        }

        // Serve a cached variant when one was asked for and the asset is an
        // image we can re-encode. GIF is excluded upstream so animation
        // survives, and PDFs obviously have no width.
        const variantWidth = isOptimizableImage(asset.contentType ?? undefined)
            ? width
            : undefined;

        try {
            if (variantWidth !== undefined) {
                const variantKey = imageVariantKey(key, variantWidth);
                const variant =
                    (await bucket.getObject(variantKey)) ??
                    (await encodeVariantOnce(
                        ctx,
                        key,
                        variantWidth,
                        variantKey,
                        // A staged asset is deleted within two days unless
                        // something claims it. Its variants would only be
                        // objects against the quota for an upload nobody kept.
                        asset.status === "ready",
                        c.get("logger"),
                    ));

                if (!variant) {
                    // The original is still a correct answer, just a heavier
                    // one, but it must not be cached as this width's bytes.
                    return imageResponse(
                        await bucket.download(key),
                        asset.contentType || "application/octet-stream",
                        asset.originalFilename,
                        "no-store",
                    );
                }

                return imageResponse(
                    variant,
                    "image/webp",
                    asset.originalFilename,
                    longLivedCache(needsSession),
                );
            }

            const content = await bucket.download(key);

            return imageResponse(
                content,
                asset.contentType || "application/octet-stream",
                asset.originalFilename,
                longLivedCache(needsSession),
            );
        } catch {
            throw HTTPAppException.NotFound("Asset");
        }
    },
);

/**
 * Asset keys are content-addressed by a UUID and their bytes never change, so
 * every response here — original or variant — is safe to cache forever.
 *
 * `private` for det som krever innlogging: uten det kan nginx eller en CDN
 * servere galleribildet videre til noen som ikke er logget inn, og gaten er
 * omgått.
 */
function longLivedCache(needsSession: boolean): string {
    return `${needsSession ? "private" : "public"}, max-age=31536000, immutable`;
}

function imageResponse(
    body: Buffer,
    contentType: string,
    originalFilename: string,
    cacheControl: string,
): Response {
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": body.length.toString(),
            "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"`,
            "Cache-Control": cacheControl,
        },
    });
}
