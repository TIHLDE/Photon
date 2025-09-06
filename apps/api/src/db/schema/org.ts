import {
    primaryKey,
    serial,
    text,
    varchar,
    uuid,
    integer,
    pgTableCreator,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { pgEnum } from "drizzle-orm/pg-core";

const pgTable = pgTableCreator((name) => `org_${name}`);

export const studyProgramType = pgEnum("study_program_type", [
    "bachelor",
    "master",
]);

export const studyProgram = pgTable("study_program", {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    feideCode: varchar("feide_code", { length: 32 }).notNull().unique(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    type: studyProgramType("type").notNull(),
});

export const studyProgramMembership = pgTable(
    "study_program_membership",
    {
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        studyProgramId: serial("study_program_id")
            .notNull()
            .references(() => studyProgram.id, { onDelete: "cascade" }),
        startYear: integer("start_year").notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.studyProgramId] })],
);
