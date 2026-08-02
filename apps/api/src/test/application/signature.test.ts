import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { buildSignature } from "~/lib/application/service";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * The line stamped into an application PDF, e.g. "brotherman: Dataingeniør -
 * 2023".
 *
 * It used to read `studyProgramMembership`, which only gets rows from a Feide
 * login: 8 of 1707 members in production have one. Everyone else — including
 * all 1667 carrying study and cohort groups from Lepton — was signed with a
 * bare username. It also interpolated the year unguarded, so the members who
 * did have a row but no cohort were signed "... - null".
 *
 * These tests pin the signature to the group projection, which is what every
 * other study read in the codebase uses.
 */

const seedStudyGroups = async (ctx: IntegrationTestContext) => {
    await ctx.db
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
                slug: "2023",
                name: "2023",
                type: "STUDYYEAR",
                finesInfo: "",
                finesActivated: false,
            },
            {
                slug: "2021",
                name: "2021",
                type: "STUDYYEAR",
                finesInfo: "",
                finesActivated: false,
            },
        ])
        .onConflictDoNothing();
};

const joinGroups = async (
    ctx: IntegrationTestContext,
    userId: string,
    slugs: string[],
) => {
    await ctx.db
        .insert(schema.groupMembership)
        .values(
            slugs.map((groupSlug) => ({
                userId,
                groupSlug,
                role: "member" as const,
            })),
        )
        .onConflictDoNothing();
};

/**
 * A member with an NTNU username, which is what every member migrated from
 * Lepton has and what the signature is supposed to lead with. `createTestUser`
 * leaves it unset, and the fallback to the display name would otherwise hide
 * whether the username branch works at all.
 */
const createMemberWithUsername = async (
    ctx: IntegrationTestContext,
    username: string,
) => {
    const user = await ctx.utils.createTestUser();
    await ctx.db
        .update(schema.user)
        .set({ username })
        .where(eq(schema.user.id, user.id));
    return user;
};

describe("buildSignature", () => {
    integrationTest(
        "signs a Lepton-migrated member from their groups alone",
        async ({ ctx }) => {
            await seedStudyGroups(ctx);
            const user = await createMemberWithUsername(ctx, "natalict");
            await joinGroups(ctx, user.id, ["dataingenior", "2023"]);

            /**
             * The 1667-member case: study and cohort groups, and no
             * `studyProgramMembership` row at all. Reading the table here is
             * what produced a bare username for almost every application.
             */
            const rows = await ctx.db
                .select({ userId: schema.studyProgramMembership.userId })
                .from(schema.studyProgramMembership);
            expect(rows).toEqual([]);

            const signature = await buildSignature(ctx, user.id);

            expect(signature).toBe(`natalict: Dataingeniør - 2023`);
        },
    );

    integrationTest(
        "uses the most recent cohort when a member has several",
        async ({ ctx }) => {
            await seedStudyGroups(ctx);
            const user = await createMemberWithUsername(ctx, "natalict");
            // A bachelor who continued into a master keeps both cohorts.
            await joinGroups(ctx, user.id, ["dataingenior", "2021", "2023"]);

            const signature = await buildSignature(ctx, user.id);

            expect(signature).toBe(`natalict: Dataingeniør - 2023`);
        },
    );

    integrationTest(
        "never signs anyone with the literal string null",
        async ({ ctx }) => {
            await seedStudyGroups(ctx);
            const user = await createMemberWithUsername(ctx, "natalict");
            // A programme with no cohort — the ITBAITBEDR shape before the
            // sync started assuming an intake, and still the alumni shape.
            await joinGroups(ctx, user.id, ["dataingenior"]);

            const signature = await buildSignature(ctx, user.id);

            expect(signature).not.toContain("null");
            expect(signature).toBe(`natalict: Dataingeniør`);
        },
    );

    integrationTest(
        "falls back to the username when there is no study at all",
        async ({ ctx }) => {
            await seedStudyGroups(ctx);
            const user = await createMemberWithUsername(ctx, "natalict");

            // Honorary members and long-gone alumni have neither group.
            const signature = await buildSignature(ctx, user.id);

            expect(signature).toBe("natalict");
        },
    );

    integrationTest(
        "falls back to the display name when there is no username either",
        async ({ ctx }) => {
            await seedStudyGroups(ctx);
            // Members who signed up with e-mail and password never got an NTNU
            // username; signing them with a raw user id would be unreadable.
            const user = await ctx.utils.createTestUser();
            await joinGroups(ctx, user.id, ["dataingenior", "2023"]);

            const signature = await buildSignature(ctx, user.id);

            expect(signature).toBe(`${user.name}: Dataingeniør - 2023`);
        },
    );

    integrationTest(
        "ignores groups that are neither study nor cohort",
        async ({ ctx }) => {
            await seedStudyGroups(ctx);
            await ctx.db.insert(schema.group).values({
                slug: "promo",
                name: "Promo",
                type: "SUBGROUP",
                finesInfo: "",
                finesActivated: false,
            });

            const user = await createMemberWithUsername(ctx, "natalict");
            await joinGroups(ctx, user.id, ["promo", "dataingenior", "2023"]);

            const signature = await buildSignature(ctx, user.id);

            expect(signature).toBe(`natalict: Dataingeniør - 2023`);
        },
    );
});
