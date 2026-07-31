import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    jsonb,
    numeric,
    pgTableCreator,
    primaryKey,
    serial,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";
import { role } from "./rbac";

const pgTable = pgTableCreator((name) => `org_${name}`);

/**
 * The NTNU institutes TIHLDE's study programmes belong to. Most of them run
 * under IDI (Institutt for datateknologi og informatikk), but Digital
 * infrastruktur og cybersikkerhet belongs to IIK (Institutt for
 * informasjonssikkerhet og kommunikasjonsteknologi). Arrangements funded or
 * run on behalf of one institute may only admit that institute's students.
 */
export const institute = pgTable("institute", {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    /** Short form used in the UI, e.g. "IDI". */
    shortName: varchar("short_name", { length: 16 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ...timestamps,
});

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

/**
 * The NTNU campuses TIHLDE's study programmes run on. TIHLDE covers Trondheim.
 */
export const campus = pgEnum("org_campus", ["trondheim", "gjovik", "alesund"]);

export type Campus = (typeof campus)["enumValues"][number];

export const studyProgramMembership = pgTable(
    "study_program_membership",
    {
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        studyProgramId: serial("study_program_id")
            .notNull()
            .references(() => studyProgram.id, { onDelete: "cascade" }),
        /**
         * Cohort start year, or null when Feide only gave us the programme.
         *
         * The year comes from the `fc:fs:kull` cohort group, and that group is
         * not always there: a member admitted on a study right without a
         * cohort, an exchange student, or a programme that was restructured
         * can have the programme and no cohort at all. Recording the
         * membership without a year beats refusing the row — the row is what
         * carries campus stickiness and proves enrolment later.
         */
        startYear: integer("start_year"),
        /**
         * The campus we have positively confirmed the member studies at, from
         * their Feide course codes. NTNU runs BIDATA and BDIGSEC on several
         * campuses under one programme code, so the code alone does not say
         * where someone studies.
         *
         * Write-once, and deliberately not "where are they now": a member on
         * exchange, or taking a semester at another campus, reads as something
         * else that semester without ever having stopped being a Trondheim
         * student. Once set to "trondheim" this is what earns them permanent
         * access to the programme. NULL means we have never had a clear
         * reading — everyone migrated from Lepton starts out that way, and
         * fills in on their next login with campus-marked courses.
         */
        confirmedCampus: campus("confirmed_campus"),
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
     * Optional RBAC role that gets auto-assigned to the group's LEADER only.
     * Assigned when a member becomes leader, revoked when they step down or
     * leave. Used for leader-bound powers (e.g. NOK leader → payments:refund).
     */
    leaderRoleId: integer("leader_role_id").references(() => role.id, {
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
    contractSigningRequired: boolean("contract_signing_required")
        .notNull()
        .default(false),
    /**
     * The NTNU institute this group belongs to. Only meaningful for study
     * groups (type "study"), where it decides which institute-restricted
     * events the members may register for. NULL means "no institute", which
     * is the case for every non-study group and is never a reason to grant
     * access — an institute-restricted event admits nobody without a match.
     */
    instituteId: integer("institute_id").references(() => institute.id, {
        onDelete: "set null",
    }),
    ...timestamps,
});

export const groupRelations = relations(group, ({ one }) => ({
    institute: one(institute, {
        fields: [group.instituteId],
        references: [institute.id],
    }),
}));

export const instituteRelations = relations(institute, ({ many }) => ({
    groups: many(group),
}));

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

/**
 * Ended group memberships — the "tidligere medlemmer" list on a group page.
 *
 * `groupMembership` is the current roster and its rows are deleted outright
 * when someone leaves, so the group's history would otherwise be lost. A row
 * is appended here every time a membership is removed. It is a separate table
 * rather than a nullable `endedAt` on the membership because the same person
 * can join, leave and rejoin a group repeatedly, and each stint is its own
 * period.
 *
 * `role` is stored as free text rather than the enum: Lepton's history
 * (which this table is backfilled from) recorded board positions like
 * "TREASURER" that Photon's two-value enum has no room for, and the value is
 * only ever displayed.
 */
export const groupMembershipHistory = pgTable(
    "group_membership_history",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, { onDelete: "cascade" }),
        role: varchar("role", { length: 50 }).notNull().default("member"),
        startedAt: timestamp("started_at").notNull(),
        /**
         * Stamped by the database, not by the API. These are `timestamp`
         * columns without a time zone, so a `now()` default follows whatever
         * zone the *database* runs in while a value sent from Node is written
         * as UTC by the driver. `startedAt` is copied from the membership's
         * `createdAt`, which `now()` stamped — so stamping `endedAt` from Node
         * mixes two clocks, and on a database that is not in UTC (the test
         * container is an hour ahead) a stint appears to end before it began.
         * Keeping both ends on the database clock makes the pair consistent
         * whatever zone it runs in.
         */
        endedAt: timestamp("ended_at").notNull().defaultNow(),
        ...timestamps,
    },
    (t) => [
        index("group_membership_history_group_slug_idx").on(t.groupSlug),
        index("group_membership_history_user_id_idx").on(t.userId),
        /**
         * One row per stint. Re-running the Lepton backfill, or two removals
         * racing, must not duplicate an entry — this mirrors Lepton's own
         * unique_together on (user, group, end_date).
         */
        uniqueIndex("group_membership_history_stint_idx").on(
            t.userId,
            t.groupSlug,
            t.endedAt,
        ),
    ],
);

export const groupMembershipHistoryRelations = relations(
    groupMembershipHistory,
    ({ one }) => ({
        user: one(user, {
            fields: [groupMembershipHistory.userId],
            references: [user.id],
        }),
        group: one(group, {
            fields: [groupMembershipHistory.groupSlug],
            references: [group.slug],
        }),
    }),
);

/**
 * Scope for permissions granted by a group position (verv/tittel).
 *
 * - group: permissions apply only within the position's group, i.e. they are
 *   granted as "permission@group:<slug>" (e.g. Økonomiansvarlig i Volley).
 * - global: permissions apply everywhere (e.g. HS-verv like President →
 *   roles:assign). Creating/updating global positions requires global
 *   "roles:create" — enforced in the API layer.
 */
export const groupPositionScope = pgEnum("org_group_position_scope", [
    "group",
    "global",
]);

export type GroupPositionScope =
    (typeof groupPositionScope)["enumValues"][number];

/**
 * A named position (verv/tittel) within a group, e.g. "Økonomiansvarlig",
 * "President". Positions carry a permission list that holders receive —
 * scoped to the group or globally depending on `scope`.
 *
 * Names are intentionally NOT unique per group: a position is held by at
 * most ONE user, so a group needing two økonomiansvarlige simply creates
 * two "Økonomiansvarlig" positions.
 */
export const groupPosition = pgTable("group_position", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    permissions: text("permissions").array().notNull().default([]),
    scope: groupPositionScope("scope").notNull().default("group"),
    /**
     * Marks this position as THE leader-verv for another group (a subgroup).
     * When that group's leadership changes, the new leader is auto-added to
     * HS and auto-assigned this position (see syncSubgroupLeadership in
     * apps/api). E.g. Teknologiminister has linkedGroupSlug "index". Deleted
     * with the linked group.
     */
    linkedGroupSlug: varchar("linked_group_slug", { length: 128 }).references(
        () => group.slug,
        { onDelete: "cascade" },
    ),
    ...timestamps,
});

/**
 * Assignment of a group position to a user. A position has at most ONE
 * holder (positionId is the primary key). Holders must be members of the
 * position's group (enforced in the API layer; membership removal also
 * removes the user's positions in that group).
 */
export const groupPositionHolder = pgTable("group_position_holder", {
    positionId: uuid("position_id")
        .primaryKey()
        .references(() => groupPosition.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    /** User who assigned the position (audit trail) */
    grantedBy: varchar("granted_by", { length: 255 }).references(
        () => user.id,
        { onDelete: "set null" },
    ),
    ...timestamps,
});

export const groupPositionRelations = relations(groupPosition, ({ one }) => ({
    group: one(group, {
        fields: [groupPosition.groupSlug],
        references: [group.slug],
    }),
    holder: one(groupPositionHolder),
}));

export const groupPositionHolderRelations = relations(
    groupPositionHolder,
    ({ one }) => ({
        position: one(groupPosition, {
            fields: [groupPositionHolder.positionId],
            references: [groupPosition.id],
        }),
        user: one(user, {
            fields: [groupPositionHolder.userId],
            references: [user.id],
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
    /** Optional evidence image URL (migrated from Lepton's OptionalImage). */
    image: varchar("image", { length: 600 }),
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

export const fineRelations = relations(fine, ({ one }) => ({
    user: one(user, {
        fields: [fine.userId],
        references: [user.id],
        relationName: "fineUser",
    }),
    createdByUser: one(user, {
        fields: [fine.createdByUserId],
        references: [user.id],
        relationName: "fineCreatedByUser",
    }),
}));

/**
 * A group's fine law ("lovverk"): the numbered paragraphs members can be
 * fined under. Ported from Lepton's `group_law` table. `amount` is the
 * default number of units for a fine given under this paragraph.
 */
export const groupLaw = pgTable("group_law", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, { onDelete: "cascade" }),
    /** Paragraph number, e.g. 1.00 or 3.12 — mirrors Lepton's decimal(4,2). */
    paragraph: numeric("paragraph", { precision: 4, scale: 2 }).notNull(),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description").notNull().default(""),
    amount: integer("amount").notNull().default(1),
    ...timestamps,
});

export const groupLawRelations = relations(groupLaw, ({ one }) => ({
    group: one(group, {
        fields: [groupLaw.groupSlug],
        references: [group.slug],
    }),
}));

/**
 * Where a signature is drawn on the contract PDF.
 *
 * Normalized to 0..1 of each page's dimensions with a top-left origin, matching
 * how the browser places the field. pdf-lib uses a bottom-left origin, so `y` is
 * flipped at stamping time.
 */
export type SignaturePlacement = {
    page: number;
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
};

export const contract = pgTable("contract", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 256 }).notNull(),
    fileKey: varchar("file_key", { length: 600 }).notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    /** Where the member's signature image is stamped. Null until placed. */
    signaturePlacement: jsonb(
        "signature_placement",
    ).$type<SignaturePlacement>(),
    /** Optional "sted og dato" line, placed next to the signature. */
    namePlacement: jsonb("name_placement").$type<SignaturePlacement>(),
    createdByUserId: varchar("created_by_user_id", { length: 255 }).references(
        () => user.id,
        { onDelete: "set null" },
    ),
    ...timestamps,
});

export const contractSignature = pgTable(
    "contract_signature",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        contractId: uuid("contract_id")
            .notNull()
            .references(() => contract.id, { onDelete: "cascade" }),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        signedAt: timestamp("signed_at").defaultNow().notNull(),
        /** Name the signer typed, kept verbatim even if they later rename. */
        signedName: varchar("signed_name", { length: 256 }).notNull(),
        /**
         * The contract PDF with the signature stamped in, frozen at signing time
         * so the signed document stays a fixed artifact. Private: reachable only
         * via GET /api/contracts/signed-pdf, never the public asset route.
         */
        signedPdfKey: varchar("signed_pdf_key", { length: 600 }).notNull(),
        /** SHA-256 of the stamped PDF, to prove it has not been altered since. */
        signedPdfHash: varchar("signed_pdf_hash", { length: 64 }).notNull(),
        /** Raw signature PNG, retained so stamped PDFs can be regenerated. */
        signatureFileKey: varchar("signature_file_key", {
            length: 600,
        }).notNull(),
        signerIp: varchar("signer_ip", { length: 45 }),
        signerUa: text("signer_ua"),
        ...timestamps,
    },
    (t) => [
        uniqueIndex("contract_signature_unique_idx").on(t.contractId, t.userId),
    ],
);
