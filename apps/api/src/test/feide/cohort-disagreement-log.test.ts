import {
    applyFeideStudyPrograms,
    parseValidStudyPrograms,
    partitionByCampus,
    resolveCampus,
} from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * A cohort from Feide that contradicts the member must leave a trace.
 *
 * The year freezes on arrival, so a wrong one is invisible from then on: the
 * member keeps their old cohort group, the profile quietly shows no class
 * level, and the priority pools skip them. The only symptom anyone ever
 * reports is a lost place on an event weeks later. These tests pin the two
 * lines that make it greppable instead.
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

const trondheimCourses = ["INGT1002", "IMAT1002", "IDATT1003"];

const AUTUMN_2026 = new Date("2026-09-17T10:00:00Z");

type FeideGroups = Parameters<typeof parseValidStudyPrograms>[0];

const seedProgrammes = async (db: NodePgDatabase<DbSchema>) => {
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

const joinCohortGroup = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    year: string,
) => {
    await db
        .insert(schema.group)
        .values({
            slug: year,
            name: year,
            type: "STUDYYEAR",
            finesInfo: "",
            finesActivated: false,
        })
        .onConflictDoNothing();

    await db
        .insert(schema.groupMembership)
        .values({ userId, groupSlug: year, role: "member" })
        .onConflictDoNothing();
};

const signInWithFeide = async (
    db: NodePgDatabase<DbSchema>,
    userId: string,
    groups: FeideGroups,
    now = AUTUMN_2026,
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
        now,
    );
};

describe("logging a cohort Feide disagrees with", () => {
    let warned: string[] = [];

    beforeEach(() => {
        warned = [];
        vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
            warned.push(args.map(String).join(" "));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const linesMentioning = (userId: string) =>
        warned.filter((line) => line.includes(userId));

    integrationTest(
        "names the member when Feide's cohort contradicts the group they are in",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            // The production shape: admitted in 2024, but Feide carries an
            // older kull. On a three-year bachelor 2023 computes to a fourth
            // year that does not exist, so the class level lands on null.
            await joinCohortGroup(ctx.db, user.id, "2024");

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2023H"),
                ...trondheimCourses.map(emne),
            ]);

            const lines = linesMentioning(user.id);
            expect(lines).toHaveLength(1);
            expect(lines[0]).toContain("2023");
            expect(lines[0]).toContain("2024");
            expect(lines[0]).toContain("dataingenior");
        },
    );

    integrationTest(
        "reports what Feide says about a year that is already settled",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();
            await joinCohortGroup(ctx.db, user.id, "2024");

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2023H"),
                ...trondheimCourses.map(emne),
            ]);

            // The correction outranks Feide and stands, so the next login is
            // the only place the real Feide value can still be read.
            await ctx.db
                .update(schema.studyProgramMembership)
                .set({ startYear: 2024, startYearSource: "manual" })
                .where(eq(schema.studyProgramMembership.userId, user.id));

            warned.length = 0;

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2023H"),
                ...trondheimCourses.map(emne),
            ]);

            const lines = linesMentioning(user.id);
            expect(lines).toHaveLength(1);
            expect(lines[0]).toContain("manual");
            expect(lines[0]).toContain("2023");

            const [row] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    source: schema.studyProgramMembership.startYearSource,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(row?.startYear).toBe(2024);
            expect(row?.source).toBe("manual");
        },
    );

    integrationTest(
        "does not claim a derived year was kept when Feide replaced it",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();
            await joinCohortGroup(ctx.db, user.id, "2024");

            // ITBAITBEDR gets no kull from Feide, so the first login works the
            // year out from the cohort group and stores it as `derived`.
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: (
                    await ctx.db
                        .select({ id: schema.studyProgram.id })
                        .from(schema.studyProgram)
                        .where(eq(schema.studyProgram.feideCode, "BIDATA"))
                )[0]!.id,
                startYear: 2024,
                startYearSource: "derived",
            });

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2023H"),
                ...trondheimCourses.map(emne),
            ]);

            // `derived` loses to `feide`, so 2023 is what now decides the
            // class level — the line must say that, not that 2024 stood.
            const lines = linesMentioning(user.id);
            expect(lines).toHaveLength(1);
            expect(lines[0]).not.toContain("keeps cohort");
            expect(lines[0]).toContain("Storing 2023");

            const [row] = await ctx.db
                .select({
                    startYear: schema.studyProgramMembership.startYear,
                    source: schema.studyProgramMembership.startYearSource,
                })
                .from(schema.studyProgramMembership)
                .where(eq(schema.studyProgramMembership.userId, user.id));

            expect(row?.startYear).toBe(2023);
            expect(row?.source).toBe("feide");
        },
    );

    integrationTest(
        "stays quiet when Feide agrees with the member's cohort group",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();
            await joinCohortGroup(ctx.db, user.id, "2024");

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2024H"),
                ...trondheimCourses.map(emne),
            ]);

            expect(linesMentioning(user.id)).toEqual([]);
        },
    );

    integrationTest(
        "stays quiet for a member with no cohort group yet",
        async ({ ctx }) => {
            await seedProgrammes(ctx.db);
            const user = await ctx.utils.createTestUser();

            await signInWithFeide(ctx.db, user.id, [
                prg("BIDATA"),
                kull("BIDATA", "2026H"),
                ...trondheimCourses.map(emne),
            ]);

            expect(linesMentioning(user.id)).toEqual([]);
        },
    );
});
