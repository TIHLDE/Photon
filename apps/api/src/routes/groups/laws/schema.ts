import z from "zod";
import { Schema } from "~/lib/openapi";

// ===== INPUT SCHEMAS =====

export const createLawSchema = Schema(
    "CreateLaw",
    z.object({
        paragraph: z
            .number()
            .min(0)
            .max(99.99)
            .meta({ description: "Paragraph number, e.g. 1 or 3.12" }),
        title: z.string().min(1).max(100).meta({ description: "Law title" }),
        description: z
            .string()
            .optional()
            .meta({ description: "Longer description of the law" }),
        amount: z
            .number()
            .int()
            .min(0)
            .optional()
            .meta({ description: "Default number of fine units" }),
    }),
);

export const updateLawSchema = Schema(
    "UpdateLaw",
    z.object({
        paragraph: z
            .number()
            .min(0)
            .max(99.99)
            .optional()
            .meta({ description: "Paragraph number, e.g. 1 or 3.12" }),
        title: z
            .string()
            .min(1)
            .max(100)
            .optional()
            .meta({ description: "Law title" }),
        description: z
            .string()
            .optional()
            .meta({ description: "Longer description of the law" }),
        amount: z
            .number()
            .int()
            .min(0)
            .optional()
            .meta({ description: "Default number of fine units" }),
    }),
);

// ===== RESPONSE SCHEMAS =====

export const lawSchema = Schema(
    "Law",
    z.object({
        id: z.string().meta({ description: "Law ID" }),
        groupSlug: z.string().meta({ description: "Group the law belongs to" }),
        paragraph: z
            .string()
            .meta({ description: "Paragraph number as a decimal string" }),
        title: z.string().meta({ description: "Law title" }),
        description: z
            .string()
            .meta({ description: "Longer description of the law" }),
        amount: z
            .number()
            .meta({ description: "Default number of fine units" }),
        createdAt: z.string().meta({ description: "Creation timestamp" }),
        updatedAt: z.string().meta({ description: "Last update timestamp" }),
    }),
);

export const lawListSchema = Schema("LawList", z.array(lawSchema));
