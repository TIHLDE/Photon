import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createFineSchema = Schema(
    "CreateFine",
    z.object({
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
            // 0 er lov: en bot kan registreres som en advarsel som ikke teller
            // i summene, selv om paragrafen foreslår én eller flere.
            .min(0)
            .meta({ description: "Number of fines given (0 or more)" }),
        defense: z
            .string()
            .optional()
            .meta({ description: "User's defense text" }),
        image: z
            .url()
            .max(600)
            .optional()
            .meta({ description: "Evidence image URL" }),
        lawId: z.uuid().optional().meta({
            description:
                "Paragraph in the group's lovverk the fine is given under. Optional: a group whose lovverk is empty can still hand out fines.",
        }),
    }),
);

export const fineStatusSchema = z
    .enum(["pending", "approved", "paid", "rejected"])
    .meta({ description: "Fine status" });

export const updateFineSchema = Schema(
    "UpdateFine",
    z.object({
        defense: z
            .string()
            .optional()
            .meta({ description: "User's defense text" }),
        status: fineStatusSchema.optional(),
    }),
);

export const batchUpdateFinesSchema = Schema(
    "BatchUpdateFines",
    z.object({
        fineIds: z
            .array(z.uuid())
            .min(1)
            .meta({ description: "The fines to update" }),
        status: fineStatusSchema,
    }),
);

export const batchUpdateUserFinesSchema = Schema(
    "BatchUpdateUserFines",
    z.object({
        status: fineStatusSchema,
    }),
);

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
        image: z.string().nullable().meta({
            description:
                "Evidence image URL. Private — the asset route refuses it; read the picture through GET /api/groups/{groupSlug}/fines/{fineId}/image. Use this field only to tell whether a fine has a picture.",
        }),
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
        user: z
            .object({
                id: z.string().meta({ description: "User ID" }),
                name: z.string().meta({ description: "User display name" }),
                image: z
                    .string()
                    .nullable()
                    .meta({ description: "User profile image URL" }),
            })
            .meta({
                description: "Public user info for the fined user",
            }),
        createdByUser: z
            .object({
                id: z.string().meta({ description: "User ID" }),
                name: z.string().meta({ description: "User display name" }),
                image: z
                    .string()
                    .nullable()
                    .meta({ description: "User profile image URL" }),
            })
            .nullable()
            .meta({
                description: "Public user info for the fine creator",
            }),
        lawId: z.string().nullable().meta({
            description: "ID of the paragraph the fine was given under",
        }),
        law: z
            .object({
                id: z.string().meta({ description: "Law ID" }),
                paragraph: z
                    .string()
                    .meta({ description: "Paragraph number, e.g. 3.10" }),
                title: z.string().meta({ description: "Paragraph title" }),
            })
            .nullable()
            .meta({
                description:
                    "The paragraph in the group's lovverk. Null for fines migrated from Lepton and for fines given without one.",
            }),
    }),
);

export const fineListResponseSchema = Schema(
    "FineList",
    z.object({
        totalCount: z.number().meta({ description: "Total number of fines" }),
        pages: z.number().meta({ description: "Total number of pages" }),
        nextPage: z
            .number()
            .nullable()
            .meta({ description: "Next page number, or null if last page" }),
        fines: z.array(fineSchema),
    }),
);

/**
 * Group totals, one bucket per status. The buckets are mutually exclusive
 * because a fine has exactly one status — unlike Lepton, where `payed` and
 * `approved` were independent booleans and an unapproved-but-paid fine was
 * counted twice. `rejected` is deliberately left out of every bucket: a
 * rejected fine is not owed.
 */
export const fineStatisticsSchema = Schema(
    "FineStatistics",
    z.object({
        notApproved: z.number().meta({
            description: "Sum of amounts for fines awaiting approval",
        }),
        approvedNotPaid: z
            .number()
            .meta({ description: "Sum of amounts for approved, unpaid fines" }),
        paid: z.number().meta({ description: "Sum of amounts for paid fines" }),
    }),
);

export const fineUserListResponseSchema = Schema(
    "FineUserList",
    z.object({
        totalCount: z.number().meta({ description: "Total number of members" }),
        pages: z.number().meta({ description: "Total number of pages" }),
        nextPage: z
            .number()
            .nullable()
            .meta({ description: "Next page number, or null if last page" }),
        users: z.array(
            z.object({
                id: z.string().meta({ description: "User ID" }),
                name: z.string().meta({ description: "User display name" }),
                image: z
                    .string()
                    .nullable()
                    .meta({ description: "User profile image URL" }),
                finesAmount: z.number().meta({
                    description:
                        "Sum of the member's fine amounts in this group, 0 when they have none",
                }),
                finesCount: z
                    .number()
                    .meta({ description: "Number of fines the member has" }),
            }),
        ),
    }),
);

export const updateFineResponseSchema = Schema(
    "UpdateFineResponse",
    z.object({
        message: z.string(),
    }),
);

export const batchUpdateFinesResponseSchema = Schema(
    "BatchUpdateFinesResponse",
    z.object({
        message: z.string(),
        updated: z
            .number()
            .meta({ description: "Number of fines that were updated" }),
    }),
);
