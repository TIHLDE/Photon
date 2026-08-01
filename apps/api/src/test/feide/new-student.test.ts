import {
    applyFeideStudyPrograms,
    parseValidStudyPrograms,
    partitionByCampus,
    resolveCampus,
} from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * A student who has never had a TIHLDE account.
 *
 * Every Feide login verified in production so far belonged to a member
 * migrated from Lepton, so the path a first-year takes during fadderuka — no
 * user row, no groups, no roles, nothing to bridge to — had never been
 * exercised. These tests pin down what such a login actually produces, in
 * particular whether the member lands in the groups that event priority reads.
 *
 * Priority is decided purely by group slug (see `lib/event/priority.ts`), and
 * of the pools inherited from Lepton 172 select on a cohort group and 107 on a
 * study group. So "did the right rows appear" is the whole question.
 */

const kull = (code: string, year: string) => ({
    id: `fc:fs:fs:kull:ntnu.no:${code}:${year}`,
    type: "fc:fs:kull",
    displayName: `Kull for Høst ${year.slice(0, 4)} ${code}`,
    membership: { active: true },
});

const prg = (code: string) => ({
    id: `fc:fs:fs:prg:ntnu.no:${code}`,
    type: "fc:fs:prg",
    displayName: code,
    membership: { active: true },
});

const emne = (code: string) => ({
    id: `fc:fs:fs:emne:ntnu.no:${code}:1`,
    type: "fc:fs:emne",
    displayName: code,
    membership: { active: true },
});

/** The courses a first-semester Dataingeniør student in Trondheim has. */
const firstSemester = ["INGT1002", "IMAT1002", "IDATT1003", "IDATT1004"];

type FeideGroups = Parameters<typeof parseValidStudyPrograms>[0];

/**
 * Seed the two rows a programme needs to exist at all: the study programme
 * itself and the group it projects onto. `syncDerivedStudyGroups` deliberately
 * refuses to invent study groups — they carry curated names and images — so
 * without this seed a real login would log a warning and write nothing.
 */
const seedProgramme = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values({
            slug: "dataingenior",
            name: "Dataingeniør",
            type: "STUDY",
            finesInfo: "",
            finesActivated: false,
        })
        .onConflictDoNothing();

    await db
        .insert(schema.studyProgram)
        .values({
            slug: "dataingenior",
            feideCode: "BIDATA",
            displayName: "Dataingeniør",
            type: "bachelor",
        })
        .onConflictDoNothing();

    await db
        .insert(schema.role)
        .values([{ name: "member" }, { name: "alumni" }])
        .onConflictDoNothing();
};

/**
 * A Feide callback, driven directly so the payload can be chosen.
 *
 * Only the network- and session-bound parts are stripped; everything that
 * touches the database is the production function itself. This used to be a
 * hand-written copy of that sequence, which stopped matching the moment the
 * sync changed — the copy kept passing while production did something else.
 *
 * `now` is injectable because the cohort a member is assumed into depends on
 * which side of August the login falls on.
 */
const signInWithFeide = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groups: FeideGroups,
    now = new Date(),
) => {
    const campus = resolveCampus(groups);
    const { allowed, campusRejected } = partitionByCampus(
        parseValidStudyPrograms(groups),
        campus,
    );

    await applyFeideStudyPrograms(
        db,
        userId,
        allowed,
        campusRejected,
        campus,
        null,
        now,
    );
};

const groupSlugsOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const rows = await db
        .select({ slug: schema.groupMembership.groupSlug })
        .from(schema.groupMembership)
        .where(eq(schema.groupMembership.userId, userId));
    return rows.map((r) => r.slug).sort();
};

const rolesOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const rows = await db
        .select({ name: schema.role.name })
        .from(schema.userRole)
        .innerJoin(schema.role, eq(schema.role.id, schema.userRole.roleId))
        .where(eq(schema.userRole.userId, userId));
    return rows.map((r) => r.name).sort();
};

describe("a student with no prior TIHLDE account", () => {
    integrationTest(
        "lands in both the study and the cohort group when Feide gives a kull",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            // Nothing carried over: this is the fadderuka case.
            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([]);
            expect(await rolesOf(ctx.db, user.id)).toEqual([]);

            await signInWithFeide(ctx.db, user.id, [
                kull("BIDATA", "2026H"),
                prg("BIDATA"),
                ...firstSemester.map(emne),
            ]);

            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([
                "2026",
                "dataingenior",
            ]);
            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);

            const [membership] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    campus: schema.studyProgramMembership.confirmedCampus,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(membership?.startYear).toBe(2026);
            expect(membership?.campus).toBe("trondheim");
        },
    );

    integrationTest(
        "creates the cohort group for an intake nobody has joined before",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            const before = await ctx.db
                .select({ slug: schema.group.slug })
                .from(schema.group)
                .where(eq(schema.group.slug, "2026"));
            expect(before).toEqual([]);

            await signInWithFeide(ctx.db, user.id, [
                kull("BIDATA", "2026H"),
                ...firstSemester.map(emne),
            ]);

            const [created] = await ctx.db
                .select({ slug: schema.group.slug, type: schema.group.type })
                .from(schema.group)
                .where(eq(schema.group.slug, "2026"));

            expect(created?.type).toBe("STUDYYEAR");
        },
    );

    integrationTest(
        "is assumed into the current intake when Feide omits the kull",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * NTNU does not hand this service a cohort for every programme.
             * ITBAITBEDR never gets one — confirmed across every such login in
             * production, including one from a student with no prior studies
             * at all — so without a guess the member would land in no cohort,
             * and the 172 pools that select on one could never match them.
             *
             * The guess is the current intake, which is right for the autumn
             * admission and for anyone transferring in. Someone further along
             * who registers late is wrong, notices (they lose priority on their
             * own graduation ball) and gets corrected by hand.
             */
            await signInWithFeide(
                ctx.db,
                user.id,
                [prg("BIDATA"), ...firstSemester.map(emne)],
                new Date("2026-08-15T12:00:00Z"),
            );

            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([
                "2026",
                "dataingenior",
            ]);
            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);

            const [membership] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    source: schema.studyProgramMembership.startYearSource,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(membership?.startYear).toBe(2026);
            // Recorded as a guess, so a real year from Feide can replace it
            // later and a manual correction can outrank it.
            expect(membership?.source).toBe("assumed");
        },
    );

    integrationTest(
        "is not assumed into an intake when the membership has lapsed",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * An alumnus whose programme group is still in the response but no
             * longer active. Guessing here would stamp someone who finished
             * years ago as a fresh first-year and hand them priority on the
             * intake's events.
             */
            await signInWithFeide(
                ctx.db,
                user.id,
                [
                    { ...prg("BIDATA"), membership: { active: false } },
                    ...firstSemester.map(emne),
                ],
                new Date("2026-08-15T12:00:00Z"),
            );

            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([
                "dataingenior",
            ]);

            const [membership] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    source: schema.studyProgramMembership.startYearSource,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(membership).toBeDefined();
            expect(membership?.startYear).toBeNull();
            expect(membership?.source).toBeNull();

            // Nothing may conjure a STUDYYEAR group out of a missing year.
            const invented = await ctx.db
                .select({ slug: schema.group.slug })
                .from(schema.group)
                .where(eq(schema.group.type, "STUDYYEAR"));
            expect(invented).toEqual([]);
        },
    );

    integrationTest(
        "is kept out entirely when the courses place them at another campus",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                kull("BIDATA", "2026H"),
                emne("INGG1002"),
                emne("IMAG1002"),
                emne("IDATG1003"),
            ]);

            // A Gjøvik student gets no programme, no groups and no role — but
            // the account itself still exists, so support can act on it.
            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([]);
            expect(await rolesOf(ctx.db, user.id)).toEqual([]);

            const memberships = await ctx.db
                .select({ userId: schema.studyProgramMembership.userId })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));
            expect(memberships).toEqual([]);
        },
    );

    integrationTest(
        "does not become alumni on a first login that finds nothing",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * Someone outside TIHLDE's programmes entirely. They must end up
             * with neither role: "alumni" would claim a history they never had,
             * and the guard in syncBaselineRoles keys on a study-programme row
             * precisely to avoid that.
             */
            await signInWithFeide(ctx.db, user.id, [
                prg("MTDT"),
                emne("TDT4100"),
            ]);

            expect(await rolesOf(ctx.db, user.id)).toEqual([]);
            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([]);
        },
    );

    integrationTest(
        "keeps its groups when a later login no longer reports the programme",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                kull("BIDATA", "2026H"),
                ...firstSemester.map(emne),
            ]);

            // Three years on: the memberships have lapsed.
            await signInWithFeide(ctx.db, user.id, [
                {
                    ...kull("BIDATA", "2026H"),
                    membership: { active: false },
                },
                ...firstSemester.map(emne),
            ]);

            // "Én gang TIHLDE-medlem, alltid TIHLDE-medlem": the groups stay,
            // only the baseline role moves.
            expect(await groupSlugsOf(ctx.db, user.id)).toEqual([
                "2026",
                "dataingenior",
            ]);
            expect(await rolesOf(ctx.db, user.id)).toEqual(["alumni"]);
        },
    );
});

describe("the groups a new student's priority depends on", () => {
    integrationTest(
        "matches a pool that requires both study and cohort group",
        async ({ ctx }) => {
            await seedProgramme(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                kull("BIDATA", "2026H"),
                ...firstSemester.map(emne),
            ]);

            // The shape 172 of the inherited pools have: study + studyyear.
            const pool = ["dataingenior", "2026"];
            const held = await ctx.db
                .select({ slug: schema.groupMembership.groupSlug })
                .from(schema.groupMembership)
                .where(
                    and(
                        eq(schema.groupMembership.userId, user.id),
                        inArray(schema.groupMembership.groupSlug, pool),
                    ),
                );

            expect(held).toHaveLength(pool.length);
        },
    );
});
