import { metadataResponseSchema } from "./schema";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const getRoute = route().get(
    "/metadata/:key{.+}",
    describeRoute({
        tags: ["assets"],
        summary: "Get asset metadata",
        operationId: "getAssetMetadata",
        description: `Get metadata for an asset by its key. No authentication required.

The key is the full path returned when uploading, e.g., \`uploads/2024/01/uuid_filename.jpg\``,
    })
        .schemaResponse({
            statusCode: 200,
            schema: metadataResponseSchema,
            description: "Asset metadata",
        })
        .notFound({ description: "Asset not found" })
        .build(),
    async (c) => {
        const { bucket } = c.get("ctx");
        const key = c.req.param("key");

        const asset = await bucket.getAsset(key);

        if (!asset) {
            throw HTTPAppException.NotFound("Asset");
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
