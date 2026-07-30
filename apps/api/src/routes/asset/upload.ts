import {
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    generateAssetKey,
    isAllowedMimeType,
} from "~/lib/asset";
import { IMAGE_MAX_DIMENSION, optimizeImage } from "~/lib/asset/image";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuthOrApiKey } from "~/middleware/auth-or-api-key";
import { uploadResponseSchema } from "./schema";

export const uploadRoute = route().post(
    "/",
    describeRoute({
        tags: ["assets"],
        summary: "Upload a file",
        operationId: "uploadAsset",
        description: `Upload a file to staging. The file will be automatically cleaned up after 2 days if not promoted.

Requires either session authentication or a valid API key.

**Constraints:**
- Maximum file size: ${MAX_FILE_SIZE / 1024 / 1024}MB
- Allowed MIME types: ${ALLOWED_MIME_TYPES.join(", ")}

**Image optimization:**
JPEG, PNG and WebP uploads are re-encoded to WebP, scaled to fit within ${IMAGE_MAX_DIMENSION}x${IMAGE_MAX_DIMENSION} px and stripped of metadata. The response therefore reports the stored \`contentType\`, \`size\` and \`originalFilename\` (extension swapped to \`.webp\`), which may differ from what was sent. GIF is passed through untouched so animation survives.

**Usage:**
Send the file as multipart/form-data with a field named "file".

Pass an optional "visibility" field set to "private" for files that must not be served by the open \`GET /api/assets/:key\` route — those are only reachable through a route that does its own authorization (e.g. application attachments).`,
    })
        .schemaResponse({
            statusCode: 201,
            schema: uploadResponseSchema,
            description: "File uploaded successfully",
        })
        .badRequest({ description: "Invalid file type or size exceeded" })
        .unauthorized()
        .build(),
    requireAuthOrApiKey,
    async (c) => {
        const { bucket } = c.get("ctx");

        // Parse multipart form data
        const formData = await c.req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            throw HTTPAppException.BadRequest(
                "No file provided. Send a file with field name 'file'.",
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            throw HTTPAppException.BadRequest(
                `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            );
        }

        // Validate MIME type
        if (!isAllowedMimeType(file.type)) {
            throw HTTPAppException.BadRequest(
                `File type '${file.type}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
            );
        }

        // Get uploader ID (from session user or API key owner)
        const user = c.get("user");
        const apiKey = c.get("apiKey");
        const uploadedById = user?.id ?? apiKey?.createdById ?? undefined;

        // Callers may opt a file out of the open download route. Anyone may
        // do so: "private" only removes a way to read the file, it never
        // grants access.
        const visibilityField = formData.get("visibility");
        if (
            visibilityField !== null &&
            visibilityField !== "public" &&
            visibilityField !== "private"
        ) {
            throw HTTPAppException.BadRequest(
                "Field 'visibility' must be 'public' or 'private'",
            );
        }
        const visibility = visibilityField === "private" ? "private" : "public";

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Re-encode images to WebP before they reach storage. Clients compress
        // too, but this is the only step every upload passes through — API keys
        // and migration scripts included — so it is what actually guarantees no
        // oversized original is ever served.
        const optimized = await optimizeImage(
            buffer,
            file.type,
            file.name,
            c.get("logger"),
        );

        const storedBuffer = optimized?.buffer ?? buffer;
        const storedFilename = optimized?.filename ?? file.name;
        const storedContentType = optimized?.contentType ?? file.type;

        // Generate unique key
        const key = generateAssetKey(storedFilename);

        // Upload to storage
        await bucket.upload(key, storedBuffer, {
            originalFilename: storedFilename,
            contentType: storedContentType,
            uploadedById,
            visibility,
        });

        // Get the created asset
        const asset = await bucket.getAsset(key);

        if (!asset) {
            throw HTTPAppException.InternalError(
                "Failed to create asset record",
            );
        }

        return c.json(
            {
                key: asset.key,
                originalFilename: asset.originalFilename,
                contentType: asset.contentType,
                size: asset.size,
                status: asset.status,
            },
            201,
        );
    },
);
