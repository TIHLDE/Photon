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

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2021,
            });

            await ctx.db.transaction((tx) =>
                syncBaselineRoles(tx, user.id, false),
            );

            expect(await rolesOf(ctx.db, user.id)).toEqual(["alumni"]);
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
