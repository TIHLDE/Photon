import {
    applyFeideStudyPrograms,
    currentAcademicYear,
    parseValidStudyPrograms,
    partitionByCampus,
    resolveCampus,
} from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * What happens to a member whose programme Feide gives no cohort for.
 *
 * NTNU issues no `fc:fs:kull` for ITBAITBEDR, and none for the master either —
 * 0 of 217 rows in production between them. Because the inherited priority
 * pools select on cohort groups and class level, a member without a year loses
 * priority on everything aimed at their own intake.
 *
 * So we work the year out ourselves and record it as `derived`, the lowest
 * rank, which anything better may overwrite. These tests pin down the rules
 * that make that safe: the member's own cohort group is preferred over any
 * inference, the current intake is a last resort reserved for active
 * memberships, and the result never depends on the order Feide listed the
 * programmes in.
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

/** Trondheim course codes, so the campus gate lets the member through. */
const trondheimCourses = ["INGT1002", "IMAT1002", "IDATT1003"];

/** A login in the middle of the autumn admission. */
const DURING_INTAKE = new Date("2026-08-15T12:00:00Z");

type FeideGroups = Parameters<typeof parseValidStudyPrograms>[0];

/**
 * Both programmes TIHLDE needs here: BIDATA, which Feide gives cohorts for,
 * and ITBAITBEDR, which it does not.
 */
const seedProgrammes = async (db: NodePgDatabase<DbSchema>) => {
    await db
        .insert(schema.group)
        .values([
            {
                slug: "dataingenior",
                name: "Dataingeniør",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            },
            {
                slug: "digital-forretningsutvikling",
                name: "Digital forretningsutvikling",
                type: "STUDY",
                finesInfo: "",
                finesActivated: false,
            },
        ])
        .onConflictDoNothing();

    await db
        .insert(schema.studyProgram)
        .values([
            {
                slug: "dataingenior",
                feideCode: "BIDATA",
                displayName: "Dataingeniør",
                type: "bachelor",
            },
            {
                slug: "digital-forretningsutvikling",
                feideCode: "ITBAITBEDR",
                displayName: "Digital Forretningsutvikling",
                type: "bachelor",
            },
        ])
        .onConflictDoNothing();

    await db
        .insert(schema.role)
        .values([{ name: "member" }, { name: "alumni" }])
        .onConflictDoNothing();
};

const signInWithFeide = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groups: FeideGroups,
    now = DURING_INTAKE,
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

const cohortGroupsOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
    const rows = await db
        .select({ slug: schema.groupMembership.groupSlug })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.group.slug, schema.groupMembership.groupSlug),
        )
        .where(eq(schema.groupMembership.userId, userId));

    return rows
        .map((r) => r.slug)
        .filter((slug) => /^\d{4}$/.test(slug))
        .sort();
};

/** The membership row for one specific programme, not just the first one. */
const membershipFor = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    feideCode: string,
) => {
    const [row] = await db
        .select({
            startYear: schema.studyProgramMembership.startYear,
            source: schema.studyProgramMembership.startYearSource,
        })
        .from(schema.studyProgramMembership)
        .innerJoin(
            schema.studyProgram,
            eq(
                schema.studyProgram.id,
                schema.studyProgramMembership.studyProgramId,
            ),
        )
        .where(
            and(
                eq(schema.studyProgramMembership.userId, userId),
                eq(schema.studyProgram.feideCode, feideCode),
            ),
        )
        .limit(1);

    return row;
};

describe("currentAcademicYear", () => {
    it("rolls over in August, not in January", () => {
        // The academic year starts in August, so a member registering in
        // spring belongs to the intake that started the previous autumn.
        expect(currentAcademicYear(new Date("2026-08-01T00:00:00Z"))).toBe(
            2026,
        );
        expect(currentAcademicYear(new Date("2026-12-31T00:00:00Z"))).toBe(
            2026,
        );
        expect(currentAcademicYear(new Date("2027-03-15T00:00:00Z"))).toBe(
            2026,
        );
        expect(currentAcademicYear(new Date("2027-07-31T00:00:00Z"))).toBe(
            2026,
        );
    });
});

describe("deriving a cohort", () => {
    integrationTest(
        "takes the year from the cohort the member already has",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * The production case that makes this rule non-negotiable: every
             * ITBAITBEDR member carries a correct cohort from Lepton and gets
             * none from Feide. Inventing this year's intake on top would add a
             * second, higher year, and `Math.max()` in `deriveStudyFromGroups`
             * would pick it — the whole cohort demoted to first-years on their
             * next login.
             *
             * The cohort group is not merely a veto, it is the answer: it holds
             * the member's real intake, so the programme row is filled from it
             * rather than left empty. That is what the older `assumed` rule got
             * wrong, and why 118 ITBAITBEDR rows sat permanently without a year.
             */
            await ctx.db
                .insert(schema.group)
                .values({
                    slug: "2025",
                    name: "2025",
                    type: "STUDYYEAR",
                    finesInfo: "",
                    finesActivated: false,
                })
                .onConflictDoNothing();
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: user.id, groupSlug: "2025", role: "member" });

            await signInWithFeide(ctx.db, user.id, [
                prg("ITBAITBEDR"),
                ...trondheimCourses.map(emne),
            ]);

            // Still exactly one intake — no second cohort group invented.
            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual(["2025"]);

            const membership = await membershipFor(
                ctx.db,
                user.id,
                "ITBAITBEDR",
            );
            expect(membership?.startYear).toBe(2025);
            expect(membership?.source).toBe("derived");
        },
    );

    integrationTest(
        "does not depend on the order Feide lists the programmes in",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * A transfer from Dataingeniør into Digital forretningsutvikling:
             * one programme carries a cohort, the other cannot. Checking "do we
             * know a cohort" per programme instead of once up front would make
             * the result depend on which order Feide happened to list them in.
             */
            await signInWithFeide(ctx.db, user.id, [
                prg("ITBAITBEDR"),
                kull("BIDATA", "2023H"),
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            const forward = await cohortGroupsOf(ctx.db, user.id);

            const other = await ctx.utils.createTestUser();
            await signInWithFeide(ctx.db, other.id, [
                kull("BIDATA", "2023H"),
                prg("BIDATA"),
                prg("ITBAITBEDR"),
                ...trondheimCourses.map(emne),
            ]);

            expect(await cohortGroupsOf(ctx.db, other.id)).toEqual(forward);
        },
    );

    integrationTest(
        "is replaced when Feide later reports a real cohort",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual(["2026"]);

            // NTNU starts issuing the cohort. The guess is not history, it is a
            // wrong answer, so the group it created has to go with it.
            await signInWithFeide(ctx.db, user.id, [
                kull("BIDATA", "2024H"),
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual(["2024"]);

            const membership = await membershipFor(ctx.db, user.id, "BIDATA");
            expect(membership?.startYear).toBe(2024);
            expect(membership?.source).toBe("feide");
        },
    );

    integrationTest(
        "never overwrites a correction made by hand",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            // The board corrects a late-registering third-year.
            await ctx.db
                .update(schema.studyProgramMembership)
                .set({ startYear: 2024, startYearSource: "manual" })
                .where(eq(schema.studyProgramMembership.userId, user.id));

            /**
             * Feide keeps reporting no cohort, and would keep guessing the
             * current intake. A correction that gets silently reverted on the
             * member's next login is worse than no correction at all — they
             * would have to ask again every time they log in.
             */
            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            const membership = await membershipFor(ctx.db, user.id, "BIDATA");
            expect(membership?.startYear).toBe(2024);
            expect(membership?.source).toBe("manual");
        },
    );

    integrationTest(
        "never overwrites a year carried over from Lepton",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            await ctx.db
                .update(schema.studyProgramMembership)
                .set({ startYear: 2022, startYearSource: "migrated" })
                .where(eq(schema.studyProgramMembership.userId, user.id));

            // Real data we have no better source for; Feide's silence is not a
            // reason to discard it.
            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                ...trondheimCourses.map(emne),
            ]);

            const membership = await membershipFor(ctx.db, user.id, "BIDATA");
            expect(membership?.startYear).toBe(2022);
            expect(membership?.source).toBe("migrated");
        },
    );

    integrationTest(
        "uses the previous intake for a member registering in spring",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(
                ctx.db,
                user.id,
                [prg("ITBAITBEDR"), ...trondheimCourses.map(emne)],
                new Date("2027-03-01T12:00:00Z"),
            );

            // Still a first-year: they started the previous August.
            expect(await cohortGroupsOf(ctx.db, user.id)).toEqual(["2026"]);
        },
    );

    integrationTest(
        "fills a row that already exists without a year",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            /**
             * The shape 153 rows in production were stuck in: the membership
             * exists, but both the year and its source are NULL. The old guard
             * only ever let `feide` replace `assumed`, so such a row could
             * never be filled no matter what a later login learned — including
             * both rows belonging to every member who had gone on to the
             * master.
             */
            const [programme] = await ctx.db
                .select({ id: schema.studyProgram.id })
                .from(schema.studyProgram)
                .where(eq(schema.studyProgram.feideCode, "ITBAITBEDR"))
                .limit(1);

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: programme?.id as number,
                startYear: null,
                startYearSource: null,
            });

            await signInWithFeide(ctx.db, user.id, [
                prg("ITBAITBEDR"),
                ...trondheimCourses.map(emne),
            ]);

            const membership = await membershipFor(
                ctx.db,
                user.id,
                "ITBAITBEDR",
            );
            expect(membership?.startYear).toBe(2026);
            expect(membership?.source).toBe("derived");
        },
    );
});
