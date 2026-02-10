import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgTableCreator,
    primaryKey,
    serial,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { role } from "./rbac";

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

/**
 * Permission mode for group resource management.
 *
 * - leader_only: Only users with 'leader' role in groupMembership can manage resources
 * - member: Any group member with the base permission can manage resources
 * - custom: Custom per-resource configuration (future enhancement)
 */
export const groupPermissionMode = pgEnum("org_group_permission_mode", [
    "leader_only",
    "member",
    "custom",
]);

export type GroupPermissionMode =
    (typeof groupPermissionMode)["enumValues"][number];

export const group = pgTable("group", {
    imageUrl: varchar("image_url", { length: 600 }),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().primaryKey(),
    description: text("description"),
    contactEmail: varchar("contact_email", { length: 200 }),
    type: varchar("type", { length: 50 }).notNull(),
    finesInfo: text("fine_info").notNull(),
    finesActivated: boolean("fines_activated").notNull(),
    finesAdminId: text("fines_admin_id").references(() => user.id),
    /**
     * Optional RBAC role that gets auto-assigned to group members.
     * When a user joins this group, they automatically receive this role.
     * When they leave, the role is removed.
     */
    roleId: integer("role_id").references(() => role.id, {
        onDelete: "set null",
    }),
    /**
     * Permission mode for managing group resources (events, fines, etc.).
     * - leader_only: Only group leaders can manage (default, more restrictive)
     * - member: Any member with the base permission can manage (more permissive)
     * - custom: Future - per-resource configuration
     */
    permissionMode: groupPermissionMode("permission_mode")
        .notNull()
        .default("leader_only"),
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

export const groupMembershipRelations = relations(
    groupMembership,
    ({ one }) => ({
        user: one(user, {
            fields: [groupMembership.userId],
            references: [user.id],
        }),
        group: one(group, {
            fields: [groupMembership.groupSlug],
            references: [group.slug],
        }),
    }),
);

export const fineStatus = pgEnum("org_fine_status", [
    "pending",
    "approved",
    "paid",
    "rejected",
]);

export type FineStatus = (typeof fineStatus)["enumValues"][number];

export const fine = pgTable("fine", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 })
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    amount: integer("amount").notNull(), // Amount in NOK (or minor units)
    defense: text("defense"),
    status: fineStatus("status").notNull().default("pending"),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).references(
        () => user.id,
        { onDelete: "set null" },
    ),
    approvedByUserId: varchar("approved_by_user_id", {
        length: 255,
    }).references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    paidAt: timestamp("paid_at"),
    ...timestamps,
});
