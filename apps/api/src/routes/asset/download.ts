import {
    IMAGE_VARIANT_WIDTHS,
    type ImageVariantWidth,
    imageVariantKey,
    isImageVariantWidth,
    isOptimizableImage,
    resizeImage,
} from "~/lib/asset/image";
import { isMemberReadableAsset } from "~/lib/asset/member-readable";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";

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
parameter is ignored for non-image assets (PDF, GIF).`,
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
                let variant = await bucket.getObject(variantKey);

                if (!variant) {
                    const original = await bucket.download(key);
                    variant = await resizeImage(
                        original,
                        variantWidth,
                        c.get("logger"),
                    );

                    if (variant) {
                        // Persisted so only the first request for a given
                        // width pays the re-encode. A failure to cache is not
                        // worth failing the response over — the next request
                        // simply regenerates.
                        await bucket
                            .putObject(variantKey, variant, "image/webp")
                            .catch((error: unknown) => {
                                c.get("logger")?.warn(
                                    { err: error, variantKey },
                                    "Could not cache image variant",
                                );
                            });
                    } else {
                        // sharp unavailable or undecodable input: the original
                        // is still a correct answer, just a heavier one.
                        return imageResponse(
                            original,
                            asset.contentType || "application/octet-stream",
                            asset.originalFilename,
                            needsSession,
                        );
                    }
                }

                return imageResponse(
                    variant,
                    "image/webp",
                    asset.originalFilename,
                    needsSession,
                );
            }

            const content = await bucket.download(key);

            return imageResponse(
                content,
                asset.contentType || "application/octet-stream",
                asset.originalFilename,
                needsSession,
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
function imageResponse(
    body: Buffer,
    contentType: string,
    originalFilename: string,
    needsSession = false,
): Response {
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": body.length.toString(),
            "Content-Disposition": `inline; filename="${encodeURIComponent(originalFilename)}"`,
            "Cache-Control": `${needsSession ? "private" : "public"}, max-age=31536000, immutable`,
        },
    });
}
