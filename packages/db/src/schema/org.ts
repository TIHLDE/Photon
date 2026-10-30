import { defineRelationsPart } from "drizzle-orm";
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
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { timestamps } from "../timestamps";
import { user } from "./auth";

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
    slug: varchar("slug", { length: 64 })
        .notNull()
        .unique("org_institute_slug_unique"),
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
    slug: varchar("slug", { length: 64 })
        .notNull()
        .unique("org_study_program_slug_unique"),
    feideCode: varchar("feide_code", { length: 32 })
        .notNull()
        .unique("org_study_program_feide_code_unique"),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    type: studyProgramType("type").notNull(),
    ...timestamps,
});

/**
 * The NTNU campuses TIHLDE's study programmes run on. TIHLDE covers Trondheim.
 */
export const campus = pgEnum("org_campus", ["trondheim", "gjovik", "alesund"]);

export type Campus = (typeof campus)["enumValues"][number];

/**
 * Where a cohort start year came from, which decides who may overwrite it.
 *
 * NTNU does not hand out `fc:fs:kull` for every programme. Neither ITBAITBEDR
 * (Digital forretningsutvikling) nor ITMAIKTSA (the master) ever gets one — 0
 * of 217 rows in production between them — so for those two a year we work out
 * ourselves is not a stopgap until FS improves, it is the only source there
 * will ever be. Without one the member loses priority on everything aimed at
 * their own intake.
 *
 * Ranked, highest first: `manual` is a deliberate correction by the board;
 * `feide` is what NTNU says; `migrated` is the year Lepton carried over, real
 * data we have no better source for; `derived` is the one we worked out
 * ourselves. A higher rank overwrites a lower one and nothing else — equal
 * ranks leave the stored value alone, so the first answer of a given quality
 * stands.
 *
 * `derived` replaced an older `assumed`, which meant "this year's intake,
 * because you are active now". It answered the same question worse: it was
 * right only for someone who had just started, and said nothing for the far
 * larger group whose real intake was sitting in their cohort group all along.
 */
export const studyYearSource = pgEnum("org_study_year_source", [
    "feide",
    "derived",
    "manual",
    "migrated",
]);

export type StudyYearSource = (typeof studyYearSource)["enumValues"][number];

export const studyProgramMembership = pgTable(
    "study_program_membership",
    {
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, {
                name: "org_study_program_membership_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        studyProgramId: serial("study_program_id")
            .notNull()
            .references(() => studyProgram.id, {
                name: "org_study_program_membership_study_program_id_org_study_program",
                onDelete: "cascade",
            }),
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
        ...timestamps,
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
        /**
         * Where {@link startYear} came from; see {@link studyYearSource}.
         *
         * NULL means we have a row but never resolved a year — an alumnus
         * whose Feide membership is inactive, so guessing an intake for them
         * would stamp someone who finished years ago as a fresh first-year.
         */
        startYearSource: studyYearSource("start_year_source"),
        /**
         * Whether Feide still reported this programme as active at the
         * member's last login — `membership.active` on the Dataporten group,
         * not the mere presence of it. The group list is fetched with
         * `showAll=true`, so a programme someone finished years ago still
         * comes back; this flag is what separates the two.
         *
         * Deliberately separate from the study groups, which are additive on
         * purpose ("én gang TIHLDE-medlem, alltid TIHLDE-medlem") and so say
         * nothing about who is enrolled *now*. Anything that has to tell a
         * current student from an alumnus reads this instead — today that is
         * bøter in a study group, see `isFinesEligibleMember`.
         *
         * NULL means we have never had an answer: every row migrated from
         * Lepton starts out that way, and fills in on the member's next Feide
         * login. NULL is not "inactive" — it is "unknown" — but a caller that
         * needs positive proof of enrolment must treat it as a no, because
         * that is exactly what it is: the absence of proof.
         */
        feideActive: boolean("feide_active"),
        /**
         * When {@link feideActive} was last written, i.e. the last Feide login
         * that mentioned this programme at all. Lets a reader tell a fresh
         * "inactive" from one recorded three years ago, and is the only way to
         * see how stale the flag is — it only ever updates on login.
         */
        feideCheckedAt: timestamp("feide_checked_at"),
    },
    (t) => [
        primaryKey({
            name: "org_study_program_membership_user_id_study_program_id_pk",
            columns: [t.userId, t.studyProgramId],
        }),
    ],
);
/**
 * NB: `group.type` is a `varchar`, not this enum, and holds upper-case values
 * from the Lepton migration — including `SPORTSTEAM`, which is not listed
 * here. Treat this list as indicative, compare types case-insensitively, and
 * never assume a group's type is one of these values.
 */
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
    /**
     * Gruppebilde: the wide photo shown on the group's «Om»-page. A picture of
     * the group, not its mark — use {@link group.logoUrl} for avatars.
     */
    imageUrl: varchar("image_url", { length: 600 }),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().primaryKey(),
    description: text("description"),
    contactEmail: varchar("contact_email", { length: 200 }),
    type: varchar("type", { length: 50 }).notNull(),
    finesInfo: text("fine_info").notNull(),
    finesActivated: boolean("fines_activated").notNull(),
    finesAdminId: text("fines_admin_id").references(() => user.id, {
        name: "org_group_fines_admin_id_auth_user_id_fk",
    }),
    ...timestamps,
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
        name: "org_group_institute_id_org_institute_id_fk",
        onDelete: "set null",
    }),
    /**
     * Logo: the square mark rendered in avatars, chips and cards (circle or
     * square). This is what the Lepton import filled — the old `image_url`
     * values were logos and were moved here in migration 0039.
     */
    logoUrl: varchar("logo_url", { length: 600 }),
    /**
     * Second axis below `type`, and today only meaningful for interest groups:
     * "GRUPPE" or "IDRETTSGRUPPE". The organisation chart renders the two as
     * separate labelled sections, and nothing else distinguishes them —
     * `type` is INTERESTGROUP for both.
     *
     * Carried over from Lepton, which had the same column. Null for every
     * other group type, and null is also legitimate for an interest group
     * that has not been categorised (Lepton left `trakk` that way).
     */
    subtype: varchar("subtype", { length: 50 }),
    /**
     * Permissions held by whoever is currently the group's leader, granted
     * scoped to this group ("permission@group:<slug>").
     *
     * The leader is a membership role rather than a verv, so it had no
     * editable permission set of its own: the only way to let a leader run
     * their group's events was a global grant, which then let them run
     * everyone's. This list is the group-scoped answer, edited from the same
     * verv table as the group's positions.
     *
     * Read live at permission-check time from the current leadership (see
     * getPermissionsFromLeadership), so it needs no sync when leadership
     * changes.
     */
    leaderPermissions: text("leader_permissions").array().notNull().default([]),
    /**
     * Permissions every member of this group holds, granted scoped to the
     * group ("permission@group:<slug>"). The leader is a member too, so these
     * stack on top of {@link leaderPermissions}.
     *
     * Only the domains that own a group column mean anything here — events,
     * roles (verv administration), forms and applications. Anything else has
     * no group to narrow against and belongs in
     * {@link memberGlobalPermissions} instead.
     *
     * Stores bare permission names; the "@group:<slug>" suffix is applied at
     * read time by getPermissionsFromMembership. Deliberately NOT stored
     * pre-scoped: a slug rename cascades across the foreign keys but would
     * never reach a slug buried inside a text[] element, which would silently
     * void every grant.
     */
    memberPermissions: text("member_permissions").array().notNull().default([]),
    /**
     * Permissions every member of this group holds org-wide, unscoped.
     *
     * This is the big hammer — Index members administering all of TIHLDE, HS
     * running org-wide content. It replaces the old auto-assigned `admin`/`hs`
     * RBAC roles, which did exactly this but invisibly, via {@link roleId}.
     *
     * Handing these out is bounded by the same rule as verv: you may only
     * grant permissions you hold yourself, at the scope you grant them at. A
     * group leader holds nothing globally and therefore cannot write here.
     */
    memberGlobalPermissions: text("member_global_permissions")
        .array()
        .notNull()
        .default([]),
    /**
     * What this group calls its leader — "President" in HS, "Leder" everywhere
     * else. Purely a label: leadership is still the membership role, and the
     * permissions above still follow whoever holds it.
     *
     * Exists because the alternative was a verv named "President" pointing at
     * the same person as the leader row, which then showed up twice in the
     * admin table and needed its permissions kept in sync by hand.
     *
     * NULL means "no custom title" and reads as "Leder".
     */
    leaderTitle: varchar("leader_title", { length: 128 }),
    /**
     * Permissions the group's leader holds org-wide, unscoped.
     *
     * The counterpart to {@link memberGlobalPermissions}, for the rights that
     * belong to the person rather than the group: presidenten answering
     * kontaktskjema for all of TIHLDE, not just for HS. Without it, the only
     * home for those was a verv duplicating the leader row.
     *
     * Bounded by the same rule as everything else: you may only grant what you
     * hold yourself, at the scope you grant it at — so a group leader, who
     * holds nothing globally, can never write this list.
     */
    leaderGlobalPermissions: text("leader_global_permissions")
        .array()
        .notNull()
        .default([]),
    /**
     * The study programme whose active students belong in this group.
     *
     * Set on the private group a programme runs for itself — today only
     * Digital transformasjon has one. While it is set, the Feide sync keeps
     * the roster in step with enrolment: an active student is enrolled on
     * login, and someone Feide reports as finished is removed.
     *
     * A column rather than a slug in the code, so the next programme that
     * wants one is a row to write instead of a deploy.
     *
     * Null for every other group, which is almost all of them — including the
     * `STUDY` groups themselves. Those already mirror a programme by sharing
     * its slug, and pointing them here too would give the sync two ways to
     * manage the same roster.
     */
    studyProgramId: integer("study_program_id").references(
        () => studyProgram.id,
        {
            name: "org_group_study_program_id_org_study_program_id_fk",
            onDelete: "set null",
        },
    ),
    /**
     * Set while the group is archived, null otherwise.
     *
     * Archiving is the reversible alternative to deleting: the row, roster,
     * verv, bøter and laws all stay, but the group leaves the organisation
     * chart, only its members can open it, nothing in it can be changed, and
     * it grants no permissions. Clearing the column brings all of that back.
     */
    archivedAt: timestamp("archived_at"),
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
            .references(() => user.id, {
                name: "org_group_membership_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, {
                name: "org_group_membership_group_slug_org_group_slug_fk",
                onDelete: "cascade",
            }),
        role: groupMembershipRole("role").notNull().default("member"),
        ...timestamps,
    },
    (t) => [
        primaryKey({
            name: "org_group_membership_user_id_group_slug_pk",
            columns: [t.userId, t.groupSlug],
        }),
        /**
         * The primary key answers "which groups is this user in"; this index
         * answers the other half, "who is in this group" — member lists,
         * permission checks and priority pools all ask it, and all of them
         * scanned the table to find out.
         */
        index("group_membership_group_slug_idx").on(t.groupSlug),
    ],
);
/**
 * Pending requests to join an interest group. A row lives only until a leader
 * answers it: approving turns it into a membership, declining deletes it.
 */
export const groupJoinRequest = pgTable(
    "group_join_request",
    {
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, {
                name: "org_group_join_request_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, {
                name: "org_group_join_request_group_slug_org_group_slug_fk",
                onDelete: "cascade",
            }),
        ...timestamps,
    },
    (t) => [
        primaryKey({
            name: "org_group_join_request_user_id_group_slug_pk",
            columns: [t.userId, t.groupSlug],
        }),
        index("group_join_request_group_slug_idx").on(t.groupSlug),
    ],
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
 * `role` is stored as free text rather than the enum on purpose. This is an
 * append-only record of what was true at the time, so it should not move when
 * `groupMembershipRole` gains or loses a value — a stint that ended as a role
 * Photon no longer offers still ended as that role. The value is only ever
 * displayed, never matched on.
 */
export const groupMembershipHistory = pgTable(
    "group_membership_history",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, {
                name: "org_group_membership_history_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, {
                name: "org_group_membership_history_group_slug_org_group_slug_fk",
                onDelete: "cascade",
            }),
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
 * Names are intentionally NOT unique per group, and a position may be held by
 * SEVERAL users at once: two økonomiansvarlige share one verv rather than
 * forcing the group to keep two identical rows in sync (issue #646).
 */
export const groupPosition = pgTable("group_position", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, {
            name: "org_group_position_group_slug_org_group_slug_fk",
            onDelete: "cascade",
        }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    permissions: text("permissions").array().notNull().default([]),
    scope: groupPositionScope("scope").notNull().default("group"),
    ...timestamps,
    /**
     * Marks this position as THE leader-verv for another group (a subgroup).
     * When that group's leadership changes, the new leader is auto-added to
     * HS and auto-assigned this position (see syncSubgroupLeadership in
     * apps/api). E.g. Teknologiminister has linkedGroupSlug "index". Deleted
     * with the linked group.
     */
    linkedGroupSlug: varchar("linked_group_slug", { length: 128 }).references(
        () => group.slug,
        {
            name: "org_group_position_linked_group_slug_org_group_slug_fk",
            onDelete: "cascade",
        },
    ),
    /**
     * Held across all of TIHLDE by a verv that otherwise belongs to its group,
     * like NoKs Annonsør: the group assigns it, but job postings have no group
     * to narrow to. Always empty on a `global` verv, whose `permissions`
     * already apply everywhere.
     */
    globalPermissions: text("global_permissions").array().notNull().default([]),
});

/**
 * Assignment of a group position to a user. The primary key is the pair, so a
 * position may have several holders at once — a group with two
 * arrangementsansvarlige gives both the same verv instead of maintaining two
 * identical ones. Holders must be members of the position's group (enforced in
 * the API layer; membership removal also removes the user's positions in that
 * group).
 */
export const groupPositionHolder = pgTable(
    "group_position_holder",
    {
        positionId: uuid("position_id")
            .notNull()
            .references(() => groupPosition.id, {
                name: "org_group_position_holder_position_id_org_group_position_id_fk",
                onDelete: "cascade",
            }),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, {
                name: "org_group_position_holder_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        /** User who assigned the position (audit trail) */
        grantedBy: varchar("granted_by", { length: 255 }).references(
            () => user.id,
            {
                name: "org_group_position_holder_granted_by_auth_user_id_fk",
                onDelete: "set null",
            },
        ),
        ...timestamps,
    },
    (table) => [
        primaryKey({
            name: "org_group_position_holder_position_id_user_id_pk",
            columns: [table.positionId, table.userId],
        }),
    ],
);
export const fineStatus = pgEnum("org_fine_status", [
    "pending",
    "approved",
    "paid",
    "rejected",
]);

export type FineStatus = (typeof fineStatus)["enumValues"][number];

export const fine = pgTable(
    "fine",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, {
                name: "org_fine_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        groupSlug: varchar("group_slug", { length: 128 })
            .notNull()
            .references(() => group.slug, {
                name: "org_fine_group_slug_org_group_slug_fk",
                onDelete: "cascade",
            }),
        reason: text("reason").notNull(),
        amount: integer("amount").notNull(),
        defense: text("defense"),
        status: fineStatus("status").notNull().default("pending"),
        createdByUserId: varchar("created_by_user_id", {
            length: 255,
        }).references(() => user.id, {
            name: "org_fine_created_by_user_id_auth_user_id_fk",
            onDelete: "set null",
        }),
        approvedByUserId: varchar("approved_by_user_id", {
            length: 255,
        }).references(() => user.id, {
            name: "org_fine_approved_by_user_id_auth_user_id_fk",
            onDelete: "set null",
        }),
        approvedAt: timestamp("approved_at"),
        paidAt: timestamp("paid_at"),
        ...timestamps,
        /** Optional evidence image URL (migrated from Lepton's OptionalImage). */
        image: varchar("image", { length: 600 }),
        // Amount in NOK (or minor units)
        /**
         * The paragraph in the group's lovverk the fine was given under.
         *
         * Nullable, and deliberately so in both directions: the fines migrated
         * from Lepton carry no paragraph, and a lovverk may be rewritten long
         * after a fine was handed out — deleting the paragraph clears the link
         * rather than the fine.
         */
        lawId: uuid("law_id").references((): AnyPgColumn => groupLaw.id, {
            name: "org_fine_law_id_org_group_law_id_fk",
            onDelete: "set null",
        }),
    },
    (t) => [
        /**
         * Fines are read per group first ("botlista for Index") and per
         * member second, so the group leads. The uuid primary key served
         * neither, and every listing scanned the table.
         */
        index("fine_group_slug_user_id_idx").on(t.groupSlug, t.userId),
    ],
);
/**
 * A group's fine law ("lovverk"): the numbered paragraphs members can be
 * fined under. Ported from Lepton's `group_law` table. `amount` is the
 * default number of units for a fine given under this paragraph.
 */
export const groupLaw = pgTable("group_law", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupSlug: varchar("group_slug", { length: 128 })
        .notNull()
        .references(() => group.slug, {
            name: "org_group_law_group_slug_org_group_slug_fk",
            onDelete: "cascade",
        }),
    /** Paragraph number, e.g. 1.00 or 3.12 — mirrors Lepton's decimal(4,2). */
    paragraph: numeric("paragraph", { precision: 4, scale: 2 }).notNull(),
    title: varchar("title", { length: 100 }).notNull(),
    description: text("description").notNull().default(""),
    amount: integer("amount").notNull().default(1),
    ...timestamps,
});
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
    createdByUserId: varchar("created_by_user_id", { length: 255 }).references(
        () => user.id,
        {
            name: "org_contract_created_by_user_id_auth_user_id_fk",
            onDelete: "set null",
        },
    ),
    ...timestamps,
    /** Where the member's signature image is stamped. Null until placed. */
    signaturePlacement: jsonb(
        "signature_placement",
    ).$type<SignaturePlacement>(),
    /** Optional "sted og dato" line, placed next to the signature. */
    namePlacement: jsonb("name_placement").$type<SignaturePlacement>(),
});

export const contractSignature = pgTable(
    "contract_signature",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        contractId: uuid("contract_id")
            .notNull()
            .references(() => contract.id, {
                name: "org_contract_signature_contract_id_org_contract_id_fk",
                onDelete: "cascade",
            }),
        userId: varchar("user_id", { length: 255 })
            .notNull()
            .references(() => user.id, {
                name: "org_contract_signature_user_id_auth_user_id_fk",
                onDelete: "cascade",
            }),
        signedAt: timestamp("signed_at").defaultNow().notNull(),
        ...timestamps,
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
    },
    (t) => [
        uniqueIndex("contract_signature_unique_idx").on(t.contractId, t.userId),
    ],
);

export const orgRelations = defineRelationsPart(
    {
        studyProgramMembership,
        group,
        institute,
        groupMembership,
        groupJoinRequest,
        groupMembershipHistory,
        groupPosition,
        groupPositionHolder,
        fine,
        groupLaw,
        user,
        studyProgram,
    },
    (r) => ({
        studyProgramMembership: {
            user: r.one.user({
                from: r.studyProgramMembership.userId,
                to: r.user.id,
                optional: false,
            }),
            studyProgram: r.one.studyProgram({
                from: r.studyProgramMembership.studyProgramId,
                to: r.studyProgram.id,
                optional: false,
            }),
        },
        group: {
            institute: r.one.institute({
                from: r.group.instituteId,
                to: r.institute.id,
            }),
        },
        institute: {
            groups: r.many.group({
                from: r.institute.id,
                to: r.group.instituteId,
            }),
        },
        groupMembership: {
            user: r.one.user({
                from: r.groupMembership.userId,
                to: r.user.id,
                optional: false,
            }),
            group: r.one.group({
                from: r.groupMembership.groupSlug,
                to: r.group.slug,
                optional: false,
            }),
        },
        groupJoinRequest: {
            user: r.one.user({
                from: r.groupJoinRequest.userId,
                to: r.user.id,
                optional: false,
            }),
            group: r.one.group({
                from: r.groupJoinRequest.groupSlug,
                to: r.group.slug,
                optional: false,
            }),
        },
        groupMembershipHistory: {
            user: r.one.user({
                from: r.groupMembershipHistory.userId,
                to: r.user.id,
                optional: false,
            }),
            group: r.one.group({
                from: r.groupMembershipHistory.groupSlug,
                to: r.group.slug,
                optional: false,
            }),
        },
        groupPosition: {
            group: r.one.group({
                from: r.groupPosition.groupSlug,
                to: r.group.slug,
                optional: false,
            }),
            holders: r.many.groupPositionHolder({
                from: r.groupPosition.id,
                to: r.groupPositionHolder.positionId,
            }),
        },
        groupPositionHolder: {
            position: r.one.groupPosition({
                from: r.groupPositionHolder.positionId,
                to: r.groupPosition.id,
                optional: false,
            }),
            user: r.one.user({
                from: r.groupPositionHolder.userId,
                to: r.user.id,
                optional: false,
            }),
        },
        fine: {
            user: r.one.user({
                from: r.fine.userId,
                to: r.user.id,
                alias: "fineUser",
                optional: false,
            }),
            createdByUser: r.one.user({
                from: r.fine.createdByUserId,
                to: r.user.id,
                alias: "fineCreatedByUser",
            }),
            law: r.one.groupLaw({
                from: r.fine.lawId,
                to: r.groupLaw.id,
            }),
        },
        groupLaw: {
            group: r.one.group({
                from: r.groupLaw.groupSlug,
                to: r.group.slug,
                optional: false,
            }),
        },
    }),
);
