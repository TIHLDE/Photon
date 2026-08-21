import { recoverMissingBaselineRole } from "@photon/auth/feide";
import { schema } from "@photon/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * A member whose Feide sync failed in the callback stays signed in without a
 * baseline role, and nothing retried it. In production on 2026-08-21 that
 * surfaced as "Kontoen din har ikke tilgang til å melde seg på" when the
 * immatrikuleringsball opened — on a session two weeks old, with a Feide
 * account that had synced fine before.
 */

const dataportenGroups = [
    {
        id: "fc:fs:fs:kull:ntnu.no:BIDATA:2026H",
        type: "fc:fs:kull",
        displayName: "Kull for Høst 2026 BIDATA",
        membership: { active: true },
    },
];

const stubDataporten = () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes("groups-api.dataporten.no")) {
            return new Response(JSON.stringify(dataportenGroups), {
                status: 200,
            });
        }
        if (url.includes("auth.dataporten.no/openid/userinfo")) {
            return new Response(
                JSON.stringify({
                    sub: "feide-sub",
                    "dataporten-userid_sec": ["feide:testuser@ntnu.no"],
                }),
                { status: 200 },
            );
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

async function seedStudyProgramme(ctx: IntegrationTestContext) {
    await ctx.db.insert(schema.group).values({
        slug: "dataingenior",
        name: "Dataingeniør",
        type: "STUDY",
        finesInfo: "",
        finesActivated: false,
    });
    await ctx.db.insert(schema.studyProgram).values({
        slug: "dataingenior",
        feideCode: "BIDATA",
        displayName: "Dataingeniør",
        type: "bachelor",
    });
    await ctx.db
        .insert(schema.role)
        .values([{ name: "member" }, { name: "alumni" }])
        .onConflictDoNothing();
}

async function linkFeideAccount(
    ctx: IntegrationTestContext,
    userId: string,
    accountId: string,
) {
    await ctx.db.insert(schema.account).values({
        id: `acc-${accountId}`,
        userId,
        providerId: "feide",
        accountId,
        accessToken: "token-from-the-login",
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

async function baselineRolesOf(ctx: IntegrationTestContext, userId: string) {
    const rows = await ctx.db
        .select({ name: schema.role.name })
        .from(schema.userRole)
        .innerJoin(schema.role, eq(schema.role.id, schema.userRole.roleId))
        .where(
            and(
                eq(schema.userRole.userId, userId),
                inArray(schema.role.name, ["member", "alumni"]),
            ),
        );
    return rows.map((r) => r.name);
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("recoverMissingBaselineRole", () => {
    integrationTest(
        "gives back the member role a failed callback sync never assigned",
        async ({ ctx }) => {
            stubDataporten();
            await seedStudyProgramme(ctx);

            const user = await ctx.utils.createTestUser();
            await linkFeideAccount(ctx, user.id, "feide-recovery-1");

            expect(await baselineRolesOf(ctx, user.id)).toEqual([]);

            await recoverMissingBaselineRole(ctx.db, user.id);

            expect(await baselineRolesOf(ctx, user.id)).toEqual(["member"]);
        },
        500_000,
    );

    integrationTest(
        "costs nothing for the members who already have a role",
        async ({ ctx }) => {
            const fetchMock = stubDataporten();
            await seedStudyProgramme(ctx);

            const user = await ctx.utils.createTestUser();
            await linkFeideAccount(ctx, user.id, "feide-recovery-2");

            const [memberRole] = await ctx.db
                .select({ id: schema.role.id })
                .from(schema.role)
                .where(eq(schema.role.name, "member"));
            await ctx.db
                .insert(schema.userRole)
                .values({ userId: user.id, roleId: memberRole?.id ?? 0 });

            await recoverMissingBaselineRole(ctx.db, user.id);

            // Every session goes through this: it must not talk to Feide for
            // the overwhelming majority who are fine.
            expect(fetchMock).not.toHaveBeenCalled();
            expect(await baselineRolesOf(ctx, user.id)).toEqual(["member"]);
        },
        500_000,
    );

    integrationTest(
        "leaves a self-registered account without a Feide login alone",
        async ({ ctx }) => {
            const fetchMock = stubDataporten();
            await seedStudyProgramme(ctx);

            // No role and no Feide account is not a broken state: this is
            // someone waiting for an admin to approve them.
            const user = await ctx.utils.createTestUser();

            await recoverMissingBaselineRole(ctx.db, user.id);

            expect(fetchMock).not.toHaveBeenCalled();
            expect(await baselineRolesOf(ctx, user.id)).toEqual([]);
        },
        500_000,
    );
});
