import { syncBaselineRoles } from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
import { eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * An empty Feide result is not evidence that someone graduated.
 *
 * Every member migrated from Lepton carries group memberships, so treating
 * those as "has a TIHLDE tie" demoted all of them the moment Feide returned no
 * cohort — which is exactly what happened in production on 2026-07-29 to a
 * third-year ITBAITBEDR student who had never stopped studying. Only a
 * study-programme membership, written by an earlier login that did see them
 * enrolled, is proof enough to take "member" away.
 */
describe("syncBaselineRoles", () => {
    const OUTSIDE_WINDOW = new Date("2026-10-01T09:00:00Z");
    const INSIDE_WINDOW = new Date("2026-08-20T09:00:00Z");

    const seedRoles = async (db: NodePgDatabase<DbSchema>) => {
        await db
            .insert(schema.role)
            .values([{ name: "member" }, { name: "alumni" }])
            .onConflictDoNothing();

        const rows = await db
            .select({ id: schema.role.id, name: schema.role.name })
            .from(schema.role)
            .where(inArray(schema.role.name, ["member", "alumni"]));

        const byName = new Map(rows.map((r) => [r.name, r.id]));
        const member = byName.get("member");
        const alumni = byName.get("alumni");
        if (member === undefined || alumni === undefined) {
            throw new Error("Could not seed baseline roles");
        }
        return { member, alumni };
    };

    const rolesOf = async (db: NodePgDatabase<DbSchema>, userId: string) => {
        const rows = await db
            .select({ name: schema.role.name })
            .from(schema.userRole)
            .innerJoin(schema.role, eq(schema.role.id, schema.userRole.roleId))
            .where(eq(schema.userRole.userId, userId));
        return rows.map((r) => r.name).sort();
    };

    integrationTest(
        "keeps member when Feide reports nothing and we never saw them enrolled",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            // A migrated member: group memberships, but no study programme.
            await ctx.db
                .insert(schema.group)
                .values({
                    slug: "index",
                    name: "Index",
                    type: "SUBGROUP",
                    finesInfo: "",
                    finesActivated: false,
                })
                .onConflictDoNothing();

            await ctx.db
                .insert(schema.groupMembership)
                .values({
                    userId: user.id,
                    groupSlug: "index",
                    role: "member",
                })
                .onConflictDoNothing();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    integrationTest(
        "demotes to alumni once a study programme proves they were enrolled",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            const [program] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-forretningsutvikling",
                    feideCode: "ITBAITBEDR",
                    displayName: "Digital forretningsutvikling",
                    type: "bachelor",
                })
                .returning();
            if (!program) throw new Error("Could not seed study programme");

            /**
             * `feideActive` is what makes the row proof. It is written on every
             * login that saw the programme — `false` included, since a lapsed
             * membership still comes back with `showAll=true`. A row without it
             * is either older than the column or written by something that
             * never asked Feide; see the fadderuka case below.
             */
            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2021,
                startYearSource: "feide",
                feideActive: false,
            });

            // Outside the semester registration window, where "inactive" is
            // allowed to mean something. Fixed rather than `new Date()`: run
            // in the first half of September this same case is deliberately
            // no verdict at all, and the test would flip with the calendar.
            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false, [], OUTSIDE_WINDOW),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["alumni"]);
        },
    );

    /**
     * The fadderuka registration writes a programme row of its own, holding
     * the intake it guessed. That row is not evidence of anything Feide said —
     * nobody has logged in yet — so an empty Feide result must still leave the
     * member alone. Otherwise the guess turns the very first login that comes
     * back empty into a demotion, and it is a brand new student it hits.
     *
     * `feideActive` tells the two kinds of row apart: only
     * `applyFeideStudyPrograms` writes it, and it writes it every time. A
     * manual cohort correction (`PATCH /user/:id/study-year`) creates the same
     * shape of row and is likewise no proof.
     */
    integrationTest(
        "keeps member when the only programme row is a registration guess",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            const [program] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-forretningsutvikling",
                    feideCode: "ITBAITBEDR",
                    displayName: "Digital forretningsutvikling",
                    type: "bachelor",
                })
                .returning();
            if (!program) throw new Error("Could not seed study programme");

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2026,
                startYearSource: "derived",
            });

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    integrationTest(
        "restores member when Feide reports an active programme again",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.alumni })
                .onConflictDoNothing();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, true),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    /**
     * The August reading, which is the one that broke people.
     *
     * NTNU turns `membership.active` off for anyone who has not registered for
     * the term, so through July and August it is off for every returning
     * student. Believing it demoted a second-year in three committees, and a
     * first-year who had not started yet, to `alumni` — and `alumni` is
     * precisely the role that cannot register for events.
     *
     * The verdict here does not depend on the window: even in October, an
     * inactive reading on someone two years into a three-year bachelor is not
     * evidence they graduated.
     */
    integrationTest(
        "keeps member when an inactive programme is still inside its length",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(
                    tx,
                    user.id,
                    false,
                    [
                        {
                            programSlug: "digital-forretningsutvikling",
                            startYear: 2025,
                            active: false,
                        },
                    ],
                    OUTSIDE_WINDOW,
                ),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    /**
     * The first-year case. Feide names the programme but has not flagged the
     * membership active yet, which for a brand new student is the normal state
     * for weeks. They are a member from their first login, not an alumnus and
     * not roleless.
     */
    integrationTest(
        "makes a first-year a member on an inactive first reading",
        async ({ ctx }) => {
            await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(
                    tx,
                    user.id,
                    false,
                    [
                        {
                            programSlug: "dataingenior",
                            startYear: 2026,
                            active: false,
                        },
                    ],
                    OUTSIDE_WINDOW,
                ),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    integrationTest(
        "demotes when every inactive programme is past its length",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(
                    tx,
                    user.id,
                    false,
                    [
                        {
                            programSlug: "digital-forretningsutvikling",
                            startYear: 2020,
                            active: false,
                        },
                    ],
                    OUTSIDE_WINDOW,
                ),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["alumni"]);
        },
    );

    /**
     * A finished bachelor alongside a running master is a student, not a
     * graduate. `every`, not `some` — reading it the other way takes the role
     * off everyone who continued.
     */
    integrationTest(
        "keeps member while one of several programmes is still running",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(
                    tx,
                    user.id,
                    false,
                    [
                        {
                            programSlug: "digital-forretningsutvikling",
                            startYear: 2020,
                            active: false,
                        },
                        {
                            programSlug: "digital-samhandling",
                            startYear: 2026,
                            active: false,
                        },
                    ],
                    OUTSIDE_WINDOW,
                ),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    integrationTest(
        "takes nothing away inside the semester registration window",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(
                    tx,
                    user.id,
                    false,
                    [
                        {
                            programSlug: "digital-forretningsutvikling",
                            startYear: 2020,
                            active: false,
                        },
                    ],
                    INSIDE_WINDOW,
                ),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    /**
     * The same guard on the branch that reads stored rows instead of a fresh
     * Feide answer. An empty answer about someone two years into a bachelor is
     * no more evidence than an inactive one.
     */
    integrationTest(
        "keeps member when an empty answer meets an unfinished programme",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: roles.member })
                .onConflictDoNothing();

            const [program] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-forretningsutvikling",
                    feideCode: "ITBAITBEDR",
                    displayName: "Digital forretningsutvikling",
                    type: "bachelor",
                })
                .returning();
            if (!program) throw new Error("Could not seed study programme");

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2025,
                startYearSource: "feide",
                feideActive: false,
            });

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false, [], OUTSIDE_WINDOW),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["member"]);
        },
    );

    integrationTest(
        "leaves a stranger with neither role untouched",
        async ({ ctx }) => {
            await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual([]);
        },
    );

    integrationTest(
        "does not touch roles other than the baseline pair",
        async ({ ctx }) => {
            const roles = await seedRoles(ctx.db);
            const user = await ctx.utils.createTestUser();

            const [adminRole] = await ctx.db
                .insert(schema.role)
                .values({ name: "admin-test" })
                .onConflictDoNothing()
                .returning();
            if (!adminRole) throw new Error("Could not seed extra role");

            await ctx.db.insert(schema.userRole).values([
                { userId: user.id, roleId: roles.member },
                { userId: user.id, roleId: adminRole.id },
            ]);

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual([
                "admin-test",
                "member",
            ]);
        },
    );
});
