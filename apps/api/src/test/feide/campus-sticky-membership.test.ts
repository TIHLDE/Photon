import { confirmCampus, keepExistingMemberships } from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Campus decides who gets into a study programme, not who stays in it.
 *
 * The campus reading is re-derived at every login from whichever courses are
 * active right then, so a Trondheim member on exchange — or one taking a
 * semester at another campus — can read as "Gjøvik" halfway through their
 * degree. That must never cost them a membership they already have: "én gang
 * TIHLDE-medlem, alltid TIHLDE-medlem". Losing active studies makes you
 * alumni, which syncBaselineRoles handles.
 */
describe("campus rejection is not applied to existing members", () => {
    const seedProgram = async (
        db: NodePgDatabase<DbSchema>,
        feideCode: string,
        slug: string,
    ) => {
        const [program] = await db
            .insert(schema.studyProgram)
            .values({
                slug,
                feideCode,
                displayName: slug,
                type: "bachelor",
            })
            .returning();

        if (!program) throw new Error(`Could not seed ${feideCode}`);
        return program;
    };

    integrationTest(
        "keeps a programme the member was confirmed in Trondheim on",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const program = await seedProgram(ctx.db, "BIDATA", "dataingenir");

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2023,
                confirmedCampus: "trondheim",
            });

            const kept = await ctx.db.transaction((tx) =>
                keepExistingMemberships(
                    tx,
                    user.id,
                    [{ code: "BIDATA", startYear: 2023 }],
                    "testuser",
                ),
            );

            expect(kept.map((p) => p.code)).toEqual(["BIDATA"]);
        },
    );

    integrationTest(
        "does not keep a membership that was never confirmed in Trondheim",
        async ({ ctx }) => {
            // The row a Gjøvik student gets if they log in before their FS
            // course registrations land: a membership, but no confirmed
            // campus. A bare membership must not earn permanent access.
            const user = await ctx.utils.createTestUser();
            const program = await seedProgram(ctx.db, "BIDATA", "dataingenir");

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2025,
            });

            const kept = await ctx.db.transaction((tx) =>
                keepExistingMemberships(
                    tx,
                    user.id,
                    [{ code: "BIDATA", startYear: 2025 }],
                    "testuser",
                ),
            );

            expect(kept).toEqual([]);
        },
    );

    integrationTest(
        "does not keep a membership confirmed at another campus",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const program = await seedProgram(ctx.db, "BIDATA", "dataingenir");

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2025,
                confirmedCampus: "gjovik",
            });

            const kept = await ctx.db.transaction((tx) =>
                keepExistingMemberships(
                    tx,
                    user.id,
                    [{ code: "BIDATA", startYear: 2025 }],
                    "testuser",
                ),
            );

            expect(kept).toEqual([]);
        },
    );

    integrationTest(
        "does not let a newcomer in on the same reading",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            await seedProgram(ctx.db, "BIDATA", "dataingenir");

            const kept = await ctx.db.transaction((tx) =>
                keepExistingMemberships(
                    tx,
                    user.id,
                    [{ code: "BIDATA", startYear: 2025 }],
                    "testuser",
                ),
            );

            expect(kept).toEqual([]);
        },
    );

    integrationTest(
        "keeps only the programme actually held, not every rejected one",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const held = await seedProgram(ctx.db, "BIDATA", "dataingenir");
            await seedProgram(
                ctx.db,
                "BDIGSEC",
                "digital-infrastruktur-og-cybersikkerhet",
            );

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: held.id,
                startYear: 2023,
                confirmedCampus: "trondheim",
            });

            const kept = await ctx.db.transaction((tx) =>
                keepExistingMemberships(
                    tx,
                    user.id,
                    [
                        { code: "BIDATA", startYear: 2023 },
                        { code: "BDIGSEC", startYear: 2025 },
                    ],
                    "testuser",
                ),
            );

            expect(kept.map((p) => p.code)).toEqual(["BIDATA"]);
        },
    );

    integrationTest(
        "does nothing when nothing was rejected",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();

            const kept = await ctx.db.transaction((tx) =>
                keepExistingMemberships(tx, user.id, [], "testuser"),
            );

            expect(kept).toEqual([]);
        },
    );
});

/**
 * The confirmation itself: filled in the first time Feide gives a clear
 * reading, and never rewritten after that.
 */
describe("confirmCampus", () => {
    const seedMembership = async (
        db: NodePgDatabase<DbSchema>,
        userId: string,
        confirmedCampus: "trondheim" | "gjovik" | null,
    ) => {
        const [program] = await db
            .insert(schema.studyProgram)
            .values({
                slug: "dataingenir",
                feideCode: "BIDATA",
                displayName: "Dataingeniør",
                type: "bachelor",
            })
            .returning();

        if (!program) throw new Error("Could not seed BIDATA");

        await db.insert(schema.studyProgramMembership).values({
            userId,
            studyProgramId: program.id,
            startYear: 2025,
            ...(confirmedCampus ? { confirmedCampus } : {}),
        });

        return program.id;
    };

    const readBack = async (db: NodePgDatabase<DbSchema>, userId: string) => {
        const [row] = await db
            .select({
                confirmedCampus: schema.studyProgramMembership.confirmedCampus,
            })
            .from(schema.studyProgramMembership)
            .where(eq(schema.studyProgramMembership.userId, userId));

        return row?.confirmedCampus ?? null;
    };

    integrationTest("records a campus we did not know", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();
        const programId = await seedMembership(ctx.db, user.id, null);

        await ctx.db.transaction((tx) =>
            confirmCampus(tx, user.id, programId, "trondheim"),
        );

        expect(await readBack(ctx.db, user.id)).toBe("trondheim");
    });

    integrationTest(
        "does not overwrite a confirmed Trondheim during an exchange",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const programId = await seedMembership(
                ctx.db,
                user.id,
                "trondheim",
            );

            await ctx.db.transaction((tx) =>
                confirmCampus(tx, user.id, programId, "gjovik"),
            );

            expect(await readBack(ctx.db, user.id)).toBe("trondheim");
        },
    );

    integrationTest(
        "records nothing on an unresolved campus",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const programId = await seedMembership(ctx.db, user.id, null);

            await ctx.db.transaction((tx) =>
                confirmCampus(tx, user.id, programId, null),
            );

            expect(await readBack(ctx.db, user.id)).toBeNull();
        },
    );
});
