import { relations, sql } from "drizzle-orm";
import {
    boolean,
    check,
    index,
    integer,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { studyProgram } from "./org";

const pgTable = pgTableCreator((name) => `master_study_${name}`);

export const masterStudyLocationTypeVariants = ["innland", "utland"] as const;

export const masterStudyLocationType = pgEnum(
    "master_study_location_type",
    masterStudyLocationTypeVariants,
);

export type MasterStudyLocationType =
    (typeof masterStudyLocationTypeVariants)[number];

/**
 * A master's degree option recommended to students of one of TIHLDE's
 * bachelor programmes — "Masterveiledning".
 *
 * The timestamps carry a zone, unlike the shared `timestamps` helper: an
 * application deadline is a real instant ("1. mars kl. 23:59 norsk tid"), and
 * timestamptz is read back the same whatever `TZ` the process runs in.
 */
export const masterStudyEntry = pgTable(
    "entry",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        studyProgramId: integer("study_program_id")
            .notNull()
            .references(() => studyProgram.id, { onDelete: "restrict" }),
        name: varchar("name", { length: 300 }).notNull(),
        location: varchar("location", { length: 300 }).notNull(),
        locationType: masterStudyLocationType("location_type").notNull(),
        link: varchar("link", { length: 500 }).notNull(),
        hasFinancialSupport: boolean("has_financial_support")
            .default(false)
            .notNull(),
        financialSupport: text("financial_support"),
        subjectRequirements: text("subject_requirements"),
        otherRequirements: text("other_requirements"),
        summary: text("summary"),
        applicationDeadline: timestamp("application_deadline", {
            withTimezone: true,
        }),
        createdById: text("created_by_user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (t) => [
        check(
            "master_study_entry_financial_support_check",
            sql`${t.hasFinancialSupport} OR ${t.financialSupport} IS NULL`,
        ),
        index("master_study_entry_study_program_id_idx").on(t.studyProgramId),
        index("master_study_entry_updated_at_idx").on(t.updatedAt.desc()),
    ],
);

export const masterStudyQuote = pgTable(
    "quote",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        entryId: uuid("entry_id")
            .notNull()
            .references(() => masterStudyEntry.id, { onDelete: "cascade" }),
        /** Null for an anonymous quote. */
        name: varchar("name", { length: 200 }),
        quote: text("quote").notNull(),
        /** Display order within the entry, ascending. */
        position: integer("position").default(0).notNull(),
    },
    (t) => [index("master_study_quote_entry_id_idx").on(t.entryId)],
);

export const masterStudyEntryRelations = relations(
    masterStudyEntry,
    ({ one, many }) => ({
        studyProgram: one(studyProgram, {
            fields: [masterStudyEntry.studyProgramId],
            references: [studyProgram.id],
        }),
        creator: one(user, {
            fields: [masterStudyEntry.createdById],
            references: [user.id],
        }),
        quotes: many(masterStudyQuote),
    }),
);

export const masterStudyQuoteRelations = relations(
    masterStudyQuote,
    ({ one }) => ({
        entry: one(masterStudyEntry, {
            fields: [masterStudyQuote.entryId],
            references: [masterStudyEntry.id],
        }),
    }),
);
