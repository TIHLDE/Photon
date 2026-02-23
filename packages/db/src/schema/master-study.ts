import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgEnum,
    pgTableCreator,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { studyProgram } from "./org";
import { timestamps } from "../timestamps";
import { user } from "./auth";

const pgTable = pgTableCreator((name) => `master_study_${name}`);

export const masterStudyLocationTypeVariants = ["innland", "utland"] as const;

export const masterStudyLocationType = pgEnum(
    "master_study_location_type",
    masterStudyLocationTypeVariants,
);

export type MasterStudyLocationType =
    (typeof masterStudyLocationTypeVariants)[number];

export const masterStudyEntry = pgTable("entry", {
    id: uuid("id").primaryKey().defaultRandom(),

    studyProgramId: integer("study_program_id")
        .notNull()
        .references(() => studyProgram.id, { onDelete: "restrict" }),

    name: varchar("name", { length: 300 }).notNull(),
    location: varchar("location", { length: 300 }).notNull(),
    locationType: masterStudyLocationType("location_type").notNull(),
    hasFinancialSupport: boolean("has_financial_support").default(false).notNull(),
    financialSupport: text("financial_support"),
    subjectRequirements: text("subject_requirements"),
    otherRequirements: text("other_requirements"),
    summary: text("summary"),
    applicationDeadline: timestamp("application_deadline"),
    createdById: text("created_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    ...timestamps,
});

export const masterStudyQuote = pgTable("quote", {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
        .notNull()
        .references(() => masterStudyEntry.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    quote: text("quote").notNull(),
});

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