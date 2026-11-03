import type { AuthUser } from "@photon/auth";
import { createMiddleware } from "hono/factory";
import {
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    generateAssetKey,
    isAllowedMimeType,
} from "~/lib/asset";
import { detectFileType } from "~/lib/asset/file-type";
import {
    IMAGE_MAX_DIMENSION,
    IMAGE_MAX_INPUT_PIXELS,
    exceedsPixelLimit,
    isOptimizableImage,
    optimizeImage,
} from "~/lib/asset/image";
import { type UsageWindow, takeFromWindow } from "~/lib/asset/limits";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuthOrApiKey } from "~/middleware/auth-or-api-key";
import type { LoggerType } from "~/middleware/logger";
import { uploadResponseSchema } from "./schema";

const MAX_UPLOADS_IN_FLIGHT_PER_USER = 6;

/**
 * The bucket's quota counts objects, so one account must not be able to spend
 * it. The numbers leave room for the largest legitimate case: the gallery admin
 * sending a whole event's photos one at a time.
 */
function uploadWindows(userId: string): UsageWindow[] {
    return [
        {
            name: `asset-upload:minute:${userId}`,
            limit: 120,
            seconds: 60,
        },
        {
            name: `asset-upload:day:${userId}`,
            limit: 2000,
            seconds: 24 * 60 * 60,
        },
    ];
}

const uploadsInFlight = new Map<string, number>();

const TOO_MANY_UPLOADS =
    "Du har lastet opp for mange filer. Prøv igjen senere.";

/**
 * Session and OAuth uploads count per person. API keys are left out on purpose:
 * they belong to sibling apps and are handed out by hand, one per service.
 *
 * The in-flight cap bounds memory: each request holds its whole file until done.
 */
const limitUserUploads = createMiddleware<{
    Variables: { user?: AuthUser; ctx: AppContext; logger: LoggerType };
}>(async (c, next) => {
    const userId = c.get("user")?.id;
    if (!userId) {
        await next();
        return;
    }

    const inFlight = uploadsInFlight.get(userId) ?? 0;
    if (inFlight >= MAX_UPLOADS_IN_FLIGHT_PER_USER) {
        throw new HTTPAppException({ status: 429, message: TOO_MANY_UPLOADS });
    }
    uploadsInFlight.set(userId, inFlight + 1);

    try {
        const { cache } = c.get("ctx");
        for (const window of uploadWindows(userId)) {
            if (!(await takeFromWindow(cache, window, c.get("logger")))) {
                throw new HTTPAppException({
                    status: 429,
                    message: TOO_MANY_UPLOADS,
                });
            }
        }

        await next();
    } finally {
        const remaining = (uploadsInFlight.get(userId) ?? 1) - 1;
        if (remaining > 0) {
            uploadsInFlight.set(userId, remaining);
        } else {
            uploadsInFlight.delete(userId);
        }
    }
});

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
- Allowed MIME types: ${ALLOWED_MIME_TYPES.join(", ")}. The file must really be one of them, and the stored type is the one found in its first bytes, not the one declared.
- Images larger than ${IMAGE_MAX_INPUT_PIXELS / 1_000_000} megapixels are refused.
- Signed-in users have a limit on uploads per minute and per day. API keys do not.

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
        .response({
            statusCode: 429,
            description: "Too many uploads from this user",
        })
        .response({
            statusCode: 507,
            description:
                "Insufficient Storage - the object store rejected the write because its quota is exhausted",
        })
        .build(),
    requireAuthOrApiKey,
    limitUserUploads,
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

        const realType = detectFileType(buffer);
        if (!realType) {
            throw HTTPAppException.BadRequest(
                "Innholdet i filen er ikke JPEG, PNG, GIF, WebP eller PDF.",
            );
        }

        if (
            isOptimizableImage(realType) &&
            (await exceedsPixelLimit(buffer, c.get("logger")))
        ) {
            throw HTTPAppException.BadRequest(
                `Bildet er for stort. Grensen er ${IMAGE_MAX_INPUT_PIXELS / 1_000_000} megapiksler.`,
            );
        }

        // Re-encode images to WebP before they reach storage. Clients compress
        // too, but this is the only step every upload passes through — API keys
        // and migration scripts included — so it is what actually guarantees no
        // oversized original is ever served.
        const optimized = await optimizeImage(
            buffer,
            realType,
            file.name,
            c.get("logger"),
        );

        const storedBuffer = optimized?.buffer ?? buffer;
        const storedFilename = optimized?.filename ?? file.name;
        const storedContentType = optimized?.contentType ?? realType;

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
