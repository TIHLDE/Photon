import { requireAuthOrApiKey } from "@photon/auth/server";
import {
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    generateAssetKey,
    isAllowedMimeType,
} from "~/lib/asset";
import { uploadResponseSchema } from "~/lib/asset/schema";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const uploadRoute = route().post(
    "/",
    describeRoute({
        tags: ["assets"],
        summary: "Upload a file",
        operationId: "uploadAsset",
        description: `Upload a file to staging. The file will be automatically cleaned up after 2 days if not promoted.

Requires either session authentication or a valid API key.

**Constraints:**
- Maximum file size: 10MB
- Allowed MIME types: ${ALLOWED_MIME_TYPES.join(", ")}

**Usage:**
Send the file as multipart/form-data with a field named "file".`,
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

        // Generate unique key
        const key = generateAssetKey(file.name);

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to storage
        await bucket.upload(key, buffer, {
            originalFilename: file.name,
            contentType: file.type,
            uploadedById,
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
