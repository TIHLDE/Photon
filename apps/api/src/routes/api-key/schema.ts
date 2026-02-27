import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const idParamSchema = z.object({
    id: z.uuid().meta({ description: "API key ID" }),
});

export const createApiKeySchema = z.object({
    name: z
        .string()
        .min(1)
        .max(100)
        .meta({ description: "Name for the API key" }),
    description: z
        .string()
        .min(1)
        .max(500)
        .meta({ description: "Detailed description of the API key's purpose" }),
    permissions: z.array(z.string()).min(1).meta({
        description:
            "Array of permissions granted to this API key (e.g., ['email:send', 'news:create']). Service validates against allowed permissions.",
    }),
    metadata: z
        .record(z.string(), z.unknown())
        .optional()
        .meta({ description: "Optional metadata as key-value pairs" }),
});

export const updateApiKeySchema = z.object({
    name: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .meta({ description: "Name for the API key" }),
    description: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .meta({ description: "Detailed description of the API key's purpose" }),
    permissions: z
        .array(z.string())
        .min(1)
        .optional()
        .meta({ description: "Array of permissions granted to this API key" }),
    metadata: z
        .record(z.string(), z.unknown())
        .optional()
        .meta({ description: "Optional metadata as key-value pairs" }),
});

export const validateApiKeyInputSchema = z.object({
    key: z.string().min(1).meta({ description: "The API key to validate" }),
});

// ===== RESPONSE SCHEMAS =====

export const apiKeySchema = Schema(
    "ApiKey",
    z.object({
        id: z.uuidv4().meta({ description: "API key ID" }),
        name: z.string().meta({ description: "Name of the API key" }),
        description: z
            .string()
            .meta({ description: "Description of the API key" }),
        keyPrefix: z
            .string()
            .meta({
                description:
                    "First 12 characters of the key for display",
            }),
        createdById: z
            .string()
            .nullable()
            .meta({ description: "User ID who created this key" }),
        lastUsedAt: z.iso
            .datetime()
            .nullable()
            .meta({ description: "When the key was last used" }),
        permissions: z
            .array(z.string())
            .meta({
                description:
                    "Array of permissions granted to this API key",
            }),
        metadata: z
            .record(z.string(), z.unknown())
            .nullable()
            .meta({ description: "Optional metadata as key-value pairs" }),
        createdAt: z.iso
            .datetime()
            .meta({ description: "When the key was created" }),
        updatedAt: z.iso
            .datetime()
            .meta({ description: "When the key was last updated" }),
    }),
);

export const createApiKeyResponseSchema = Schema(
    "CreateApiKeyResponse",
    apiKeySchema.extend({
        key: z.string().meta({
            description:
                "The full API key - ONLY returned on creation and regeneration. Cannot be retrieved again.",
        }),
    }),
);

export const listApiKeysResponseSchema = Schema(
    "ApiKeyList",
    z.array(apiKeySchema),
);

export const validateApiKeyResponseSchema = Schema(
    "ValidateApiKeyResponse",
    z.object({
        valid: z
            .boolean()
            .meta({ description: "Whether the API key is valid" }),
        apiKey: apiKeySchema.optional().meta({
            description:
                "The API key details and permissions if valid. Undefined if invalid.",
        }),
    }),
);

export const deleteApiKeyResponseSchema = Schema(
    "DeleteApiKeyResponse",
    z.object({
        message: z.string().meta({ description: "Success message" }),
    }),
);
