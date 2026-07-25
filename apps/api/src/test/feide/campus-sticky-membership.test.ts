import { keepExistingMemberships } from "@photon/auth/feide";
import { type DbSchema, schema } from "@photon/db";
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
        "keeps a programme the member already belongs to",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const program = await seedProgram(ctx.db, "BIDATA", "dataingenir");

            await ctx.db.insert(schema.studyProgramMembership).values({
                userId: user.id,
                studyProgramId: program.id,
                startYear: 2023,
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
