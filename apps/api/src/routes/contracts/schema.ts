import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createContractSchema = Schema(
    "CreateContract",
    z.object({
        title: z
            .string()
            .min(1)
            .max(256)
            .meta({ description: "Contract title" }),
        version: z
            .string()
            .min(1)
            .max(64)
            .meta({ description: "Version identifier e.g. '2026-01'" }),
        fileKey: z
            .string()
            .min(1)
            .max(600)
            .meta({ description: "MinIO asset key from POST /api/assets" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const contractSchema = Schema(
    "Contract",
    z.object({
        id: z.uuid(),
        title: z.string(),
        version: z.string(),
        fileKey: z.string(),
        isActive: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
);

export const contractListSchema = Schema(
    "ContractList",
    z.array(contractSchema),
);

export const activeContractSchema = Schema(
    "ActiveContract",
    contractSchema.extend({
        downloadUrl: z
            .string()
            .meta({ description: "Direct URL to stream the PDF" }),
    }),
);

export const signatureStatusSchema = Schema(
    "SignatureStatus",
    z.object({
        hasSigned: z.boolean(),
        signedAt: z.string().nullable(),
    }),
);

export const groupSignatureMemberSchema = Schema(
    "GroupSignatureMember",
    z.object({
        userId: z.string(),
        hasSigned: z.boolean(),
        signedAt: z.string().nullable(),
    }),
);

export const groupSignatureListSchema = Schema(
    "GroupSignatureList",
    z.object({
        members: z.array(groupSignatureMemberSchema),
        totalMembers: z.number(),
        signedCount: z.number(),
    }),
);

export const activateContractResponseSchema = Schema(
    "ActivateContractResponse",
    z.object({ message: z.string() }),
);

export const signContractResponseSchema = Schema(
    "SignContractResponse",
    z.object({ message: z.string(), signedAt: z.string() }),
);

export const revokeSignatureResponseSchema = Schema(
    "RevokeSignatureResponse",
    z.object({ message: z.string() }),
);
