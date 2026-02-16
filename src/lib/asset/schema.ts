import { z } from "zod";

/**
 * Maximum file size for uploads (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Allowed MIME types for file uploads
 */
export const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Check if a MIME type is allowed
 */
export function isAllowedMimeType(
    mimeType: string,
): mimeType is AllowedMimeType {
    return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Schema for asset response
 */
export const assetResponseSchema = z.object({
    id: z.string().uuid(),
    key: z.string(),
    originalFilename: z.string(),
    contentType: z.string().nullable(),
    size: z.number(),
    status: z.enum(["staged", "ready"]),
    promotedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

/**
 * Schema for upload response
 */
export const uploadResponseSchema = z.object({
    key: z
        .string()
        .meta({ description: "The unique key to reference this asset" }),
    originalFilename: z.string().meta({ description: "The original filename" }),
    contentType: z
        .string()
        .nullable()
        .meta({ description: "The MIME type of the file" }),
    size: z.number().meta({ description: "File size in bytes" }),
    status: z.enum(["staged", "ready"]).meta({ description: "Asset status" }),
});

/**
 * Schema for metadata response
 */
export const metadataResponseSchema = z.object({
    id: z.string().uuid().meta({ description: "Asset ID" }),
    key: z
        .string()
        .meta({ description: "The unique key to reference this asset" }),
    originalFilename: z.string().meta({ description: "The original filename" }),
    contentType: z
        .string()
        .nullable()
        .meta({ description: "The MIME type of the file" }),
    size: z.number().meta({ description: "File size in bytes" }),
    status: z.enum(["staged", "ready"]).meta({ description: "Asset status" }),
    promotedAt: z
        .string()
        .datetime()
        .nullable()
        .meta({ description: "When the asset was promoted" }),
    createdAt: z
        .string()
        .datetime()
        .meta({ description: "When the asset was created" }),
});
