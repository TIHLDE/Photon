import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

/**
 * Where an element is drawn on the PDF, normalized to 0..1 of the page's size
 * with a top-left origin (as the browser places it).
 */
export const placementSchema = Schema(
    "SignaturePlacement",
    z.object({
        page: z.number().int().nonnegative(),
        xPct: z.number().min(0).max(1),
        yPct: z.number().min(0).max(1),
        wPct: z.number().positive().max(1),
        hPct: z.number().positive().max(1),
    }),
);

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
            .meta({ description: "Asset key from POST /api/assets" }),
        signaturePlacement: placementSchema.nullish().meta({
            description: "Where the member's signature is stamped on the PDF",
        }),
        namePlacement: placementSchema.nullish().meta({
            description: "Where the signer's name and date are written",
        }),
    }),
);

export const signContractSchema = Schema(
    "SignContract",
    z.object({
        signedName: z.string().trim().min(1).max(256).meta({
            description: "Full name the member signed with",
        }),
        signatureDataUrl: z
            .string()
            .regex(
                /^data:image\/png;base64,/,
                "Signature must be a base64-encoded PNG data URL",
            )
            .meta({
                description:
                    "Signature as a PNG data URL, produced by the signature pad",
            }),
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
        signaturePlacement: placementSchema.nullable(),
        namePlacement: placementSchema.nullable(),
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
        signedName: z.string().nullable(),
    }),
);

export const groupSignatureMemberSchema = Schema(
    "GroupSignatureMember",
    z.object({
        userId: z.string(),
        userName: z.string().meta({ description: "User's display name" }),
        userEmail: z.string().meta({ description: "User's email address" }),
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
