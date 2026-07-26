import {
    applicationBudgetTypeVariants,
    applicationCaseTypeVariants,
    applicationStatusVariants,
    applicationTypeVariants,
} from "@photon/db/schema";
import z from "zod";
import { Schema } from "~/lib/openapi";

/**
 * Attachments are uploaded through POST /api/assets first; a submission only
 * carries the resulting keys. The cap keeps a single søknad from pulling tens
 * of megabytes into memory when its PDF is rendered.
 */
const MAX_ATTACHMENTS = 10;

const attachmentKeysSchema = z
    .array(z.string().min(1))
    .max(MAX_ATTACHMENTS)
    .meta({
        description: `Asset keys from POST /api/assets, max ${MAX_ATTACHMENTS}. Must have been uploaded by the submitting user and not yet attached to anything.`,
    });

const contactSchema = {
    contactName: z
        .string()
        .min(1)
        .max(200)
        .meta({ description: "Full name of the person submitting" }),
    contactEmail: z.email().meta({ description: "Contact email address" }),
};

// ===== INPUT SCHEMAS =====

export const createExpenseApplicationSchema = Schema(
    "CreateExpenseApplication",
    z.object({
        ...contactSchema,
        ccEmail: z.email().optional().meta({
            description:
                "Optional copy to a group's økonomiansvarlig. Must match a group's registered finance address.",
        }),
        amountNok: z
            .number()
            .int()
            .positive()
            .max(1_000_000)
            .meta({ description: "Amount in whole NOK" }),
        expenseDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være på formatet YYYY-MM-DD")
            .meta({ description: "Date of the expense, YYYY-MM-DD" }),
        groupSlug: z
            .string()
            .min(1)
            .meta({ description: "Slug of the group the expense belongs to" }),
        budgetType: z
            .enum(applicationBudgetTypeVariants)
            .meta({ description: "Which budget the expense is drawn from" }),
        description: z
            .string()
            .min(1)
            .max(5000)
            .meta({ description: "What the expense is for" }),
        accountNumber: z
            .string()
            .regex(
                /^\d{4}\.\d{2}\.\d{5}$/,
                "Kontonummer må være i formatet xxxx.xx.xxxxx",
            )
            .meta({ description: "Norwegian account number, xxxx.xx.xxxxx" }),
        // Unlike the old portal, where this was only a toast in the UI, a
        // receipt is genuinely required.
        attachmentKeys: attachmentKeysSchema
            .min(1, "Utlegg må ha minst én kvittering")
            .meta({ description: "Receipt images, at least one" }),
    }),
);

export const createSupportApplicationSchema = Schema(
    "CreateSupportApplication",
    z.object({
        ...contactSchema,
        groupSlug: z
            .string()
            .min(1)
            .meta({ description: "Slug of the group applying" }),
        purpose: z
            .string()
            .min(1)
            .max(2000)
            .meta({ description: "Purpose of the application" }),
        eventDescription: z
            .string()
            .min(1)
            .max(5000)
            .meta({ description: "Description of the event or product" }),
        justification: z
            .string()
            .min(1)
            .max(5000)
            .meta({ description: "Why the support is needed" }),
        totalAmountNok: z
            .number()
            .int()
            .positive()
            .max(10_000_000)
            .meta({ description: "Total amount applied for, in whole NOK" }),
        budgetLink: z
            .url()
            .optional()
            .meta({ description: "Optional link to a budget document" }),
        summary: z
            .string()
            .max(5000)
            .optional()
            .meta({ description: "Optional closing summary" }),
        attachmentKeys: attachmentKeysSchema.meta({
            description: "Budget documentation images",
        }),
    }),
);

export const createHsCaseApplicationSchema = Schema(
    "CreateHsCaseApplication",
    z
        .object({
            ...contactSchema,
            caseName: z
                .string()
                .min(1)
                .max(300)
                .meta({ description: "Name of the case" }),
            caseType: z
                .enum(applicationCaseTypeVariants)
                .meta({ description: "Kind of case" }),
            background: z
                .string()
                .min(1)
                .max(10000)
                .meta({ description: "Background for the case" }),
            assessment: z
                .string()
                .min(1)
                .max(10000)
                .meta({ description: "The case handler's assessment" }),
            recommendation: z.string().max(10000).optional().meta({
                description:
                    "The case handler's recommendation. Required for a Vedtakssak.",
            }),
            attachmentKeys: attachmentKeysSchema.meta({
                description: "Optional attachments",
            }),
        })
        // The old portal marked this required in the UI but left it optional
        // in validation, so a Vedtakssak could arrive without an innstilling.
        .superRefine((data, ctx) => {
            if (data.caseType === "decision" && !data.recommendation?.trim()) {
                ctx.addIssue({
                    code: "custom",
                    path: ["recommendation"],
                    message: "Vedtakssaker må ha en innstilling",
                });
            }
        }),
);

export const updateApplicationStatusSchema = Schema(
    "UpdateApplicationStatus",
    z.object({
        status: z
            .enum(applicationStatusVariants)
            .meta({ description: "New processing status" }),
        internalComment: z.string().max(5000).optional().nullable().meta({
            description: "Handler-only note. Never shown to the submitter.",
        }),
        messageToSubmitter: z.string().max(2000).optional().meta({
            description:
                "Optional message included in the decision email sent to the submitter.",
        }),
    }),
);

export const listApplicationsQuerySchema = Schema(
    "ListApplicationsQuery",
    z.object({
        type: z.enum(applicationTypeVariants).optional(),
        status: z.enum(applicationStatusVariants).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        offset: z.coerce.number().int().min(0).default(0),
    }),
);

// ===== RESPONSE SCHEMAS =====

const attachmentSchema = z.object({
    id: z.uuid(),
    assetKey: z.string(),
    kind: z.enum(["receipt", "budget", "attachment"]),
    sortOrder: z.number().int(),
});

const groupRefSchema = z.object({
    slug: z.string(),
    name: z.string(),
});

export const applicationSummarySchema = Schema(
    "ApplicationSummary",
    z.object({
        id: z.uuid(),
        type: z.enum(applicationTypeVariants),
        typeLabel: z.string().meta({ description: "Norwegian type label" }),
        status: z.enum(applicationStatusVariants),
        statusLabel: z.string().meta({ description: "Norwegian status label" }),
        title: z.string().meta({
            description:
                "Short human title — the case name, or the group and amount",
        }),
        contactName: z.string(),
        contactEmail: z.string(),
        submittedById: z.string().nullable(),
        submittedByName: z.string().nullable(),
        amountNok: z.number().int().nullable().meta({
            description: "Amount for expense/support types, otherwise null",
        }),
        groupName: z.string().nullable(),
        hasPdf: z.boolean(),
        handledByName: z.string().nullable(),
        handledAt: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
    }),
);

export const applicationListSchema = Schema(
    "ApplicationList",
    z.array(applicationSummarySchema),
);

export const applicationDetailSchema = Schema(
    "ApplicationDetail",
    applicationSummarySchema.extend({
        signature: z.string(),
        /** Only present for handlers — omitted when the submitter reads it. */
        internalComment: z.string().nullable().optional(),
        attachments: z.array(attachmentSchema),
        expense: z
            .object({
                ccEmail: z.string().nullable(),
                amountNok: z.number().int(),
                expenseDate: z.string(),
                budgetType: z.enum(applicationBudgetTypeVariants),
                budgetTypeLabel: z.string(),
                description: z.string(),
                accountNumber: z.string(),
                group: groupRefSchema,
            })
            .nullable(),
        support: z
            .object({
                purpose: z.string(),
                eventDescription: z.string(),
                justification: z.string(),
                totalAmountNok: z.number().int(),
                budgetLink: z.string().nullable(),
                summary: z.string().nullable(),
                group: groupRefSchema,
            })
            .nullable(),
        hsCase: z
            .object({
                caseName: z.string(),
                caseType: z.enum(applicationCaseTypeVariants),
                caseTypeLabel: z.string(),
                background: z.string(),
                assessment: z.string(),
                recommendation: z.string().nullable(),
            })
            .nullable(),
        companyContact: z
            .object({
                company: z.string(),
                eventTypes: z.array(z.string()),
                semesters: z.array(z.string()),
                comment: z.string().nullable(),
            })
            .nullable(),
    }),
);

export const createApplicationResponseSchema = Schema(
    "CreateApplicationResponse",
    z.object({
        id: z.uuid(),
        pdfGenerated: z.boolean().meta({
            description:
                "False when PDF rendering failed; the submission was still saved and an admin can regenerate it.",
        }),
    }),
);

export const applicationOptionsSchema = Schema(
    "ApplicationOptions",
    z.object({
        groups: z
            .array(groupRefSchema)
            .meta({ description: "Groups selectable as the applying group" }),
        ccOptions: z
            .array(groupRefSchema.extend({ email: z.string() }))
            .meta({ description: "Groups with an økonomiansvarlig address" }),
        budgetTypes: z.array(
            z.object({
                value: z.enum(applicationBudgetTypeVariants),
                label: z.string(),
            }),
        ),
        caseTypes: z.array(
            z.object({
                value: z.enum(applicationCaseTypeVariants),
                label: z.string(),
            }),
        ),
    }),
);

export const regeneratePdfResponseSchema = Schema(
    "RegenerateApplicationPdfResponse",
    z.object({ pdfAssetKey: z.string() }),
);
