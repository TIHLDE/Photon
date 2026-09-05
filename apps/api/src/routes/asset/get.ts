import { isMemberReadableAsset } from "~/lib/asset/member-readable";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import { metadataResponseSchema } from "./schema";

export const getRoute = route().get(
    "/metadata/:key{.+}",
    describeRoute({
        tags: ["assets"],
        summary: "Get asset metadata",
        operationId: "getAssetMetadata",
        description: `Get metadata for an asset by its key. No authentication required.

The key is the full path returned when uploading, e.g., \`uploads/2024/01/uuid_filename.jpg\`

Private assets are reported as missing here, exactly as \`GET /api/assets/:key\`
reports them — the size and filename of a fine's evidence picture are no more
public than its bytes.`,
    })
        .schemaResponse({
            statusCode: 200,
            schema: metadataResponseSchema,
            description: "Asset metadata",
        })
        .notFound({ description: "Asset not found" })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { bucket } = ctx;
        const key = c.req.param("key");

        const asset = await bucket.getAsset(key);

        if (!asset) {
            throw HTTPAppException.NotFound("Asset");
        }

        // Samme regel som nedlastingsruta: størrelsen og filnavnet på et
        // galleribilde er ikke mer offentlig enn bytene.
        if (asset.visibility === "private") {
            const signedIn = c.get("user") !== undefined;
            if (!signedIn || !(await isMemberReadableAsset(ctx, key))) {
                throw HTTPAppException.NotFound("Asset");
            }
        }

        return c.json({
            id: asset.id,
            key: asset.key,
            originalFilename: asset.originalFilename,
            contentType: asset.contentType,
            size: asset.size,
            status: asset.status,
            promotedAt: asset.promotedAt?.toISOString() ?? null,
            createdAt: asset.createdAt.toISOString(),
        });
    },
);
