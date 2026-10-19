import { schema } from "@photon/db";
import z from "zod";
import { Schema } from "~/lib/openapi";
import {
    PaginationSchema,
    PagniationResponseSchema,
} from "~/middleware/pagination";

// ===== PARAMS =====

export const entryIdParamSchema = z.object({
    id: z.uuid().meta({ description: "Master study entry ID" }),
});

export const entryIdOnlyParamSchema = z.object({
    entryId: z.uuid().meta({ description: "Master study entry ID" }),
});

export const quoteParamSchema = z.object({
    entryId: z.uuid().meta({ description: "Master study entry ID" }),
    quoteId: z.uuid().meta({ description: "Quote ID" }),
});

// ===== INPUT SCHEMAS =====

const linkSchema = z
    .url({ protocol: /^https?$/ })
    .max(500)
    .meta({ description: "Link to the programme's website (http or https)" });

const quoteNameSchema = z
    .string()
    .min(1)
    .max(200)
    .nullable()
    .meta({ description: "Who said it. Null for an anonymous quote" });

const quoteTextSchema = z.string().min(1).meta({ description: "The quote" });

export const createQuoteSchema = Schema(
    "CreateMasterStudyQuote",
    z.object({
        name: quoteNameSchema.optional(),
        quote: quoteTextSchema,
    }),
);

export const updateQuoteSchema = Schema(
    "UpdateMasterStudyQuote",
    z.object({
        name: quoteNameSchema.optional(),
        quote: quoteTextSchema.optional(),
    }),
);

const FINANCIAL_SUPPORT_MESSAGE =
    "financialSupport can only be set when hasFinancialSupport is true";

export const createMasterStudySchema = Schema(
    "CreateMasterStudy",
    z
        .object({
            studyProgramId: z
                .number()
                .int()
                .positive()
                .meta({ description: "The bachelor programme it builds on" }),
            name: z.string().min(1).max(300).meta({ description: "Navn" }),
            location: z.string().min(1).max(300).meta({ description: "Sted" }),
            locationType: z
                .enum(schema.masterStudyLocationTypeVariants)
                .meta({ description: "Innland or utland" }),
            link: linkSchema,
            hasFinancialSupport: z
                .boolean()
                .default(false)
                .meta({ description: "Økonomisk støtte tilgjengelig" }),
            financialSupport: z
                .string()
                .optional()
                .meta({ description: "Økonomisk støtte — detaljer" }),
            subjectRequirements: z
                .string()
                .optional()
                .meta({ description: "Fagkrav" }),
            otherRequirements: z
                .string()
                .optional()
                .meta({ description: "Øvrige krav" }),
            summary: z
                .string()
                .optional()
                .meta({ description: "Oppsummering" }),
            applicationDeadline: z.iso
                .datetime({ offset: true })
                .optional()
                .meta({ description: "Søknadsfrist (ISO 8601)" }),
            quotes: z
                .array(createQuoteSchema)
                .default([])
                .meta({ description: "Quotes from people who took it" }),
        })
        .refine(
            (data) =>
                data.hasFinancialSupport || data.financialSupport === undefined,
            { message: FINANCIAL_SUPPORT_MESSAGE, path: ["financialSupport"] },
        ),
);

export const updateMasterStudySchema = Schema(
    "UpdateMasterStudy",
    z
        .object({
            studyProgramId: z.number().int().positive().optional(),
            name: z.string().min(1).max(300).optional(),
            location: z.string().min(1).max(300).optional(),
            locationType: z
                .enum(schema.masterStudyLocationTypeVariants)
                .optional(),
            link: linkSchema.optional(),
            hasFinancialSupport: z.boolean().optional(),
            financialSupport: z.string().nullable().optional(),
            subjectRequirements: z.string().nullable().optional(),
            otherRequirements: z.string().nullable().optional(),
            summary: z.string().nullable().optional(),
            applicationDeadline: z.iso
                .datetime({ offset: true })
                .nullable()
                .optional(),
            quotes: z.array(createQuoteSchema).optional().meta({
                description: "Replaces every quote on the entry when sent",
            }),
        })
        .refine(
            (data) =>
                data.hasFinancialSupport !== false ||
                data.financialSupport == null,
            { message: FINANCIAL_SUPPORT_MESSAGE, path: ["financialSupport"] },
        ),
);

export const masterStudyListFilterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Case-insensitive match on name, location or summary",
    }),
    locationType: z
        .enum(schema.masterStudyLocationTypeVariants)
        .optional()
        .meta({ description: "Filter by innland or utland" }),
    studyProgramId: z.coerce.number().int().positive().optional().meta({
        description: "Filter by study program ID",
    }),
    // stringbool parses the "true"/"false" a query string actually carries;
    // z.coerce.boolean() turns "false" into true.
    hasFinancialSupport: z.stringbool().optional().meta({
        type: "boolean",
        description: "Filter by whether financial support is available",
    }),
});

// ===== RESPONSE SCHEMAS =====

export const masterStudyQuoteSchema = Schema(
    "MasterStudyQuote",
    z.object({
        id: z.uuid().meta({ description: "Quote ID" }),
        name: z
            .string()
            .nullable()
            .meta({ description: "Who said it; null when anonymous" }),
        quote: z.string().meta({ description: "The quote" }),
    }),
);

export const masterStudyEntrySchema = Schema(
    "MasterStudyEntry",
    z.object({
        id: z.uuid().meta({ description: "Entry ID" }),
        studyProgramId: z.number().meta({ description: "Study program ID" }),
        studyProgram: z
            .object({
                id: z.number(),
                slug: z.string(),
                displayName: z.string(),
                type: z.enum(schema.studyProgramType.enumValues),
            })
            .meta({ description: "The bachelor programme it builds on" }),
        name: z.string().meta({ description: "Navn" }),
        location: z.string().meta({ description: "Sted" }),
        locationType: z.enum(schema.masterStudyLocationTypeVariants),
        link: z
            .string()
            .meta({ description: "Link to the programme's website" }),
        hasFinancialSupport: z.boolean(),
        financialSupport: z.string().nullable(),
        subjectRequirements: z.string().nullable(),
        otherRequirements: z.string().nullable(),
        summary: z.string().nullable(),
        applicationDeadline: z.iso
            .datetime()
            .nullable()
            .meta({ description: "Søknadsfrist (ISO 8601)" }),
        quotes: z.array(masterStudyQuoteSchema),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),
);

export const masterStudyListResponseSchema = Schema(
    "MasterStudyList",
    PagniationResponseSchema.extend({
        items: z.array(masterStudyEntrySchema),
    }),
);

export const masterStudyProgramListSchema = Schema(
    "MasterStudyProgramList",
    z.array(
        z.object({
            id: z.number(),
            slug: z.string(),
            displayName: z.string(),
            type: z.enum(schema.studyProgramType.enumValues),
            entryCount: z
                .number()
                .meta({ description: "Master study entries linked to it" }),
        }),
    ),
);

export const masterStudyMessageSchema = Schema(
    "MasterStudyMessage",
    z.object({ message: z.string() }),
);
