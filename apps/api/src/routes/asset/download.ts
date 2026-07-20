import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const downloadRoute = route().get(
    "/:key{.+}",
    describeRoute({
        tags: ["assets"],
        summary: "Download a file",
        operationId: "downloadAsset",
        description: `Download a file by its key. No authentication required.

The key is the full path returned when uploading, e.g., \`uploads/2024/01/uuid_filename.jpg\`

Private assets (e.g. contract signatures) are never served here — they are only
reachable through routes that perform their own authorization.`,
    })
        .response({
            statusCode: 200,
            description: "File content with appropriate Content-Type header",
        })
        .notFound({ description: "Asset not found" })
        .build(),
    async (c) => {
        const { bucket } = c.get("ctx");
        const key = c.req.param("key");

        // Check if asset exists in database
        const asset = await bucket.getAsset(key);

        if (!asset) {
            throw HTTPAppException.NotFound("Asset");
        }

        // Private assets must go through a route that authorizes the caller.
        // Report them as missing rather than forbidden, so this route does not
        // confirm which keys exist.
        if (asset.visibility === "private") {
            throw HTTPAppException.NotFound("Asset");
        }

        // Download file from storage
        try {
            const content = await bucket.download(key);

            return new Response(content, {
                status: 200,
                headers: {
                    "Content-Type":
                        asset.contentType || "application/octet-stream",
                    "Content-Length": content.length.toString(),
                    "Content-Disposition": `inline; filename="${encodeURIComponent(asset.originalFilename)}"`,
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            });
        } catch {
            throw HTTPAppException.NotFound("Asset");
        }
    },
);
