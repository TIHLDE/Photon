import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const idParamSchema = z.object({
    id: z.uuid().meta({ description: "QR code ID" }),
});

export const createQRCodeSchema = Schema(
    "CreateQRCode",
    z.object({
        name: z
            .string()
            .min(1)
            .max(100)
            .meta({ description: "Name shown above the code" }),
        content: z.string().min(1).max(2000).meta({
            description: "The payload the code encodes — a URL or plain text",
        }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const qrCodeSchema = Schema(
    "QRCode",
    z.object({
        id: z.uuidv4().meta({ description: "QR code ID" }),
        name: z.string().meta({ description: "Name shown above the code" }),
        content: z
            .string()
            .meta({ description: "The payload the code encodes" }),
        createdAt: z.iso
            .datetime()
            .meta({ description: "When the code was created" }),
        updatedAt: z.iso
            .datetime()
            .meta({ description: "When the code was last updated" }),
    }),
);

export const qrCodeListResponseSchema = Schema(
    "QRCodeList",
    z.array(qrCodeSchema).describe("The caller's QR codes, newest first"),
);

export const deleteQRCodeResponseSchema = Schema(
    "DeleteQRCodeResponse",
    z.object({
        message: z.string().meta({ description: "Success message" }),
    }),
);
