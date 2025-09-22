import {
    primaryKey,
    serial,
    text,
    varchar,
    integer,
    pgTableCreator,
    boolean,
    timestamp,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { timestamps } from "../timestamps";

const pgTable = pgTableCreator((name) => `org_${name}`);

export const studyProgramType = pgEnum("org_study_program_type", [
    "bachelor",
    "master",
]);

export type StudyProgramType = (typeof studyProgramType)["enumValues"][number];

export const studyProgram = pgTable("study_program", {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    feideCode: varchar("feide_code", { length: 32 }).notNull().unique(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    type: studyProgramType("type").notNull(),
    ...timestamps,
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
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.userId, t.studyProgramId] })],
);

export const groupType = pgEnum("org_group_type", [
    "studyyear",
    "interestgroup",
    "committee",
    "study",
    "private",
    "board",
    "subgroup",
    "tihlde",
]);

export type GroupType = (typeof groupType)["enumValues"][number];

export const group = pgTable("group", {
    imageUrl: varchar("image_url", { length: 600 }),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().primaryKey(),
    description: text("description"),
    contactEmail: varchar("contact_email", { length: 200 }),
    type: varchar("type", { length: 50 }).notNull(),
    finesInfo: text("fine_info").notNull(),
    finesActivated: boolean("fines_activated").notNull(),
    finesAdminId: varchar("fines_admin_id", { length: 15 }).references(
        () => user.id,
    ),
    ...timestamps,
});

export const groupMembershipRole = pgEnum("org_group_membership_role", [
    "member",
    "leader",
]);

export type GroupMembershipRole =
    (typeof groupMembershipRole)["enumValues"][number];

export const groupMembership = pgTable(
    "group_membership",
    {
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, { onDelete: "cascade" }),
        role: groupMembershipRole("role").notNull().default("member"),
        ...timestamps,
    },
    (t) => [primaryKey({ columns: [t.userId, t.groupSlug] })],
);
