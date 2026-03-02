import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createFineSchema = z.object({
    userId: z
        .string()
        .max(255)
        .meta({ description: "User ID who receives the fine" }),
    groupSlug: z
        .string()
        .max(128)
        .meta({ description: "Group slug that issues the fine" }),
    reason: z.string().min(1).meta({ description: "Reason for the fine" }),
    amount: z
        .number()
        .int()
        .positive()
        .meta({ description: "Fine amount in NOK" }),
    defense: z.string().optional().meta({ description: "User's defense text" }),
});

export const updateFineSchema = z.object({
    defense: z.string().optional().meta({ description: "User's defense text" }),
    status: z
        .enum(["pending", "approved", "paid", "rejected"])
        .optional()
        .meta({ description: "Fine status" }),
    approvedByUserId: z
        .string()
        .optional()
        .meta({ description: "User who approved the fine" }),
});

// ===== RESPONSE SCHEMAS =====

export const fineSchema = Schema(
    "Fine",
    z.object({
        id: z.string().meta({ description: "Fine ID" }),
        userId: z
            .string()
            .meta({ description: "User ID who received the fine" }),
        groupSlug: z
            .string()
            .meta({ description: "Group slug that issued the fine" }),
        reason: z.string().meta({ description: "Reason for the fine" }),
        amount: z.number().meta({ description: "Fine amount in NOK" }),
        defense: z
            .string()
            .nullable()
            .meta({ description: "User's defense text" }),
        status: z.string().meta({
            description: "Fine status (pending, approved, paid, rejected)",
        }),
        createdByUserId: z
            .string()
            .nullable()
            .meta({ description: "User who created the fine" }),
        approvedByUserId: z
            .string()
            .nullable()
            .meta({ description: "User who approved the fine" }),
        approvedAt: z
            .string()
            .nullable()
            .meta({ description: "Approval timestamp" }),
        paidAt: z
            .string()
            .nullable()
            .meta({ description: "Payment timestamp" }),
        createdAt: z.string().meta({ description: "Creation timestamp" }),
        updatedAt: z.string().meta({ description: "Last update timestamp" }),
    }),
);

export const fineListSchema = Schema("FineList", z.array(fineSchema));

export const updateFineResponseSchema = Schema(
    "UpdateFineResponse",
    z.object({
        message: z.string(),
    }),
);
