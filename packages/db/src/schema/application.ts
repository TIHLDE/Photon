import { relations } from "drizzle-orm";
import {
    index,
    integer,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { group } from "./org";

// NOTE: literal full table names instead of pgTableCreator — same reasoning as
// motetid.ts: the creator's prefix is runtime-only, so at the type level the
// table would keep its base name and collide with other features' tables,
// silently breaking relational query inference across the whole schema.

/**
 * Søknadstyper, ported from the standalone utlegg.tihlde.org portal.
 *
 * `support` and `sports_support` share the exact same field set — they only
 * differ in who receives and handles them — so they share a detail table and
 * are told apart by this discriminator.
 *
 * `company_contact` is the odd one out: it comes from the public /bedrift
 * form, so it has no submitting user. It rides along here because a business
 * enquiry needs exactly what a søknad needs — a status, a handler and a
 * permanent record — and reusing the pipeline gives it the whole admin
 * inbox for free.
 */
export const applicationTypeVariants = [
    "expense",
    "support",
    "sports_support",
    "hs_case",
    "company_contact",
] as const;

export const applicationType = pgEnum(
    "application_type",
    applicationTypeVariants,
);

export type ApplicationType = (typeof applicationType)["enumValues"][number];

/** Behandlingsstatus. Norwegian labels live in the UI, not in the database. */
export const applicationStatusVariants = [
    "new",
    "in_progress",
    "approved",
    "rejected",
] as const;

export const applicationStatus = pgEnum(
    "application_status",
    applicationStatusVariants,
);

export type ApplicationStatus =
    (typeof applicationStatus)["enumValues"][number];

export const applicationBudgetTypeVariants = [
    "social_budget",
    "group_budget",
    "approved_hs_application",
    "approved_idkom_application",
] as const;

export const applicationBudgetType = pgEnum(
    "application_budget_type",
    applicationBudgetTypeVariants,
);

export type ApplicationBudgetType =
    (typeof applicationBudgetType)["enumValues"][number];

export const applicationCaseTypeVariants = [
    "discussion",
    "decision",
    "orientation",
] as const;

export const applicationCaseType = pgEnum(
    "application_case_type",
    applicationCaseTypeVariants,
);

export type ApplicationCaseType =
    (typeof applicationCaseType)["enumValues"][number];

export const applicationAttachmentKindVariants = [
    "receipt",
    "budget",
    "attachment",
] as const;

export const applicationAttachmentKind = pgEnum(
    "application_attachment_kind",
    applicationAttachmentKindVariants,
);

export type ApplicationAttachmentKind =
    (typeof applicationAttachmentKind)["enumValues"][number];

/**
 * Base row shared by every søknad. Type-specific fields live in the detail
 * tables below, keyed 1:1 on this row's id.
 */
export const application = pgTable(
    "application",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        type: applicationType("type").notNull(),
        status: applicationStatus("status").notNull().default("new"),
        /**
         * Nullable on purpose: deleting a user must not erase the financial
         * record of what they submitted.
         */
        submittedById: text("submitted_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        /** Contact details as given on the form — kept even if the user goes. */
        contactName: text("contact_name").notNull(),
        contactEmail: text("contact_email").notNull(),
        /**
         * Signature line snapshotted at submit time, e.g.
         * "brotherman: Dataingeniør - 2023". Derived server-side from the
         * session, never from client input.
         */
        signature: text("signature").notNull(),
        /** S3 key of the generated PDF. Null when generation failed. */
        pdfAssetKey: text("pdf_asset_key"),
        /** Handler-only note. Never serialized to the submitter. */
        internalComment: text("internal_comment"),
        handledById: text("handled_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        handledAt: timestamp("handled_at"),
        ...timestamps,
    },
    (table) => [
        index().on(table.submittedById, table.createdAt),
        index().on(table.type, table.status, table.createdAt),
    ],
);

/** Utlegg. */
export const applicationExpense = pgTable("application_expense", {
    applicationId: uuid("application_id")
        .primaryKey()
        .references(() => application.id, { onDelete: "cascade" }),
    /** Optional copy to a group's økonomiansvarlig. Validated as an allowlist. */
    ccEmail: text("cc_email"),
    /**
     * Kroner with øre. `numeric` rather than a float: receipts are exact to the
     * øre, and binary floats are not. Read back as a JS number — two decimals
     * under a million kroner is far inside the exact-integer range.
     */
    amountNok: numeric("amount_nok", {
        precision: 12,
        scale: 2,
        mode: "number",
    }).notNull(),
    /**
     * "YYYY-MM-DD". Stored as a string on purpose — the old portal had an
     * explicit timezone-shift workaround; a date-only string kills the class
     * of bug outright.
     */
    expenseDate: varchar("expense_date", { length: 10 }).notNull(),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, { onDelete: "restrict" }),
    budgetType: applicationBudgetType("budget_type").notNull(),
    description: text("description").notNull(),
    /** Canonical "xxxx.xx.xxxxx". */
    accountNumber: varchar("account_number", { length: 13 }).notNull(),
});

/** Søknad om støtte — used by both `support` and `sports_support`. */
export const applicationSupport = pgTable("application_support", {
    applicationId: uuid("application_id")
        .primaryKey()
        .references(() => application.id, { onDelete: "cascade" }),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, { onDelete: "restrict" }),
    purpose: text("purpose").notNull(),
    eventDescription: text("event_description").notNull(),
    justification: text("justification").notNull(),
    totalAmountNok: integer("total_amount_nok").notNull(),
    budgetLink: text("budget_link"),
    summary: text("summary"),
});

/** Sak til HS. */
export const applicationHsCase = pgTable("application_hs_case", {
    applicationId: uuid("application_id")
        .primaryKey()
        .references(() => application.id, { onDelete: "cascade" }),
    caseName: text("case_name").notNull(),
    caseType: applicationCaseType("case_type").notNull(),
    background: text("background").notNull(),
    assessment: text("assessment").notNull(),
    /**
     * Nullable here, but required by the zod schema when caseType is
     * "decision" — the old portal marked it required in the UI while leaving
     * it optional in validation.
     */
    recommendation: text("recommendation"),
});

/**
 * Henvendelse fra en bedrift, submitted through the public /bedrift form.
 *
 * `eventTypes` and `semesters` are free-form label arrays rather than enums:
 * the option lists are marketing copy that changes between semesters, and a
 * stored enquiry must keep the wording it was actually sent with.
 */
export const applicationCompanyContact = pgTable(
    "application_company_contact",
    {
        applicationId: uuid("application_id")
            .primaryKey()
            .references(() => application.id, { onDelete: "cascade" }),
        company: text("company").notNull(),
        /** Which kinds of arrangement the company is interested in. */
        eventTypes: text("event_types").array().notNull(),
        /** Which semesters they asked about, e.g. "Høst 2026". */
        semesters: text("semesters").array().notNull(),
        comment: text("comment"),
    },
);

export const applicationAttachment = pgTable(
    "application_attachment",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        applicationId: uuid("application_id")
            .notNull()
            .references(() => application.id, { onDelete: "cascade" }),
        /** S3 object key, stored as plain text like contract.fileKey. */
        assetKey: text("asset_key").notNull(),
        kind: applicationAttachmentKind("kind").notNull(),
        sortOrder: integer("sort_order").notNull().default(0),
        ...timestamps,
    },
    (table) => [index().on(table.applicationId)],
);

export const applicationRelations = relations(application, ({ one, many }) => ({
    submittedBy: one(user, {
        fields: [application.submittedById],
        references: [user.id],
        relationName: "applicationSubmitter",
    }),
    handledBy: one(user, {
        fields: [application.handledById],
        references: [user.id],
        relationName: "applicationHandler",
    }),
    expense: one(applicationExpense, {
        fields: [application.id],
        references: [applicationExpense.applicationId],
    }),
    support: one(applicationSupport, {
        fields: [application.id],
        references: [applicationSupport.applicationId],
    }),
    hsCase: one(applicationHsCase, {
        fields: [application.id],
        references: [applicationHsCase.applicationId],
    }),
    companyContact: one(applicationCompanyContact, {
        fields: [application.id],
        references: [applicationCompanyContact.applicationId],
    }),
    attachments: many(applicationAttachment),
}));

export const applicationExpenseRelations = relations(
    applicationExpense,
    ({ one }) => ({
        application: one(application, {
            fields: [applicationExpense.applicationId],
            references: [application.id],
        }),
        group: one(group, {
            fields: [applicationExpense.groupSlug],
            references: [group.slug],
        }),
    }),
);

export const applicationSupportRelations = relations(
    applicationSupport,
    ({ one }) => ({
        application: one(application, {
            fields: [applicationSupport.applicationId],
            references: [application.id],
        }),
        group: one(group, {
            fields: [applicationSupport.groupSlug],
            references: [group.slug],
        }),
    }),
);

export const applicationHsCaseRelations = relations(
    applicationHsCase,
    ({ one }) => ({
        application: one(application, {
            fields: [applicationHsCase.applicationId],
            references: [application.id],
        }),
    }),
);

export const applicationCompanyContactRelations = relations(
    applicationCompanyContact,
    ({ one }) => ({
        application: one(application, {
            fields: [applicationCompanyContact.applicationId],
            references: [application.id],
        }),
    }),
);

export const applicationAttachmentRelations = relations(
    applicationAttachment,
    ({ one }) => ({
        application: one(application, {
            fields: [applicationAttachment.applicationId],
            references: [application.id],
        }),
    }),
);

export type Application = typeof application.$inferSelect;
export type NewApplication = typeof application.$inferInsert;
export type ApplicationExpense = typeof applicationExpense.$inferSelect;
export type ApplicationSupport = typeof applicationSupport.$inferSelect;
export type ApplicationHsCase = typeof applicationHsCase.$inferSelect;
export type ApplicationCompanyContact =
    typeof applicationCompanyContact.$inferSelect;
export type ApplicationAttachment = typeof applicationAttachment.$inferSelect;
