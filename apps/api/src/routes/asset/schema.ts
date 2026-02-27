import { z } from "zod";
import { Schema } from "~/lib/openapi";

// ===== RESPONSE SCHEMAS =====

export const uploadResponseSchema = Schema(
    "UploadResponse",
    z.object({
        key: z
            .string()
            .meta({ description: "The unique key to reference this asset" }),
        originalFilename: z
            .string()
            .meta({ description: "The original filename" }),
        contentType: z
            .string()
            .nullable()
            .meta({ description: "The MIME type of the file" }),
        size: z.number().meta({ description: "File size in bytes" }),
        status: z
            .enum(["staged", "ready"])
            .meta({ description: "Asset status" }),
    }),
);

export const metadataResponseSchema = Schema(
    "AssetMetadata",
    z.object({
        id: z.string().uuid().meta({ description: "Asset ID" }),
        key: z
            .string()
            .meta({ description: "The unique key to reference this asset" }),
        originalFilename: z
            .string()
            .meta({ description: "The original filename" }),
        contentType: z
            .string()
            .nullable()
            .meta({ description: "The MIME type of the file" }),
        size: z.number().meta({ description: "File size in bytes" }),
        status: z
            .enum(["staged", "ready"])
            .meta({ description: "Asset status" }),
        promotedAt: z
            .string()
            .datetime()
            .nullable()
            .meta({ description: "When the asset was promoted" }),
        createdAt: z
            .string()
            .datetime()
            .meta({ description: "When the asset was created" }),
    }),
);

export const assetResponseSchema = Schema(
    "Asset",
    z.object({
        id: z.string().uuid(),
        key: z.string(),
        originalFilename: z.string(),
        contentType: z.string().nullable(),
        size: z.number(),
        status: z.enum(["staged", "ready"]),
        promotedAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    }),
);
