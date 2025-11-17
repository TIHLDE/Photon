import z from "zod";

export const idParamSchema = z.object({
    id: z.uuid().meta({ description: "API key ID" }),
});

export const apiKeySchema = z.object({
    id: z.uuidv4().meta({ description: "API key ID" }),
    name: z.string().meta({ description: "Name of the API key" }),
    description: z.string().meta({ description: "Description of the API key" }),
    keyPrefix: z
        .string()
        .meta({ description: "First 12 characters of the key for display" }),
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
        .meta({ description: "Array of permissions granted to this API key" }),
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
});

export const createApiKeyResponseSchema = apiKeySchema.extend({
    key: z.string().meta({
        description:
            "The full API key - ONLY returned on creation and regeneration. Cannot be retrieved again.",
    }),
});
