import {
    feideUserInfoFromProfile,
    feideUsernameOf,
    resolveMigratedEmail,
} from "@photon/auth/feide";
import { schema } from "@photon/db";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const USERID_SEC = "https://n.feide.no/claims/userid_sec";

const profileFrom = (principal: string, email: string) => ({
    sub: `feide-sub-${crypto.randomUUID()}`,
    name: "Test Person",
    email,
    [USERID_SEC]: [`feide:${principal}`],
});

/** What Better Auth does with the profile on a first-time Feide login. */
async function signInWithFeide(
    ctx: IntegrationTestContext,
    profile: ReturnType<typeof profileFrom>,
) {
    const userInfo = await feideUserInfoFromProfile(ctx.db, profile);
    const context = await ctx.auth.$context;
    type Link = Parameters<typeof handleOAuthUserInfo>;
    return handleOAuthUserInfo({ context } as unknown as Link[0], {
        userInfo: userInfo as Link[1]["userInfo"],
        account: { providerId: "feide", accountId: profile.sub },
        disableSignUp: true,
    });
}

const feideLinksOf = (ctx: IntegrationTestContext, userId: string) =>
    ctx.db.query.account.findMany({
        where: { userId, providerId: "feide" },
    });

describe("feideUsernameOf", () => {
    it("accepts the expected home organisation, whatever its case", () => {
        expect(feideUsernameOf({ [USERID_SEC]: ["feide:OlaN@NTNU.no"] })).toBe(
            "olan",
        );
    });

    it("refuses every other home organisation", () => {
        for (const principal of [
            "feide:olan@annen.no",
            "feide:olan@stud.annen.no",
            "feide:olan@ntnu.no.annen.no",
            "feide:olan@ntnu.no@annen.no",
            "feide:olan",
            "feide:@ntnu.no",
        ]) {
            expect(feideUsernameOf({ [USERID_SEC]: [principal] })).toBeNull();
        }
    });

    it("still finds the NTNU identity among other identifiers", () => {
        expect(
            feideUsernameOf({
                [USERID_SEC]: ["nin:01010112345", "feide:olan@ntnu.no"],
            }),
        ).toBe("olan");
    });
});

describe("a Feide login from another home organisation", () => {
    integrationTest(
        "is not matched to a migrated member by username",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser("privat@example.org");
            await ctx.db
                .update(schema.user)
                .set({ username: "olan", displayUsername: "olan" })
                .where(eq(schema.user.id, member.id));

            expect(
                await resolveMigratedEmail(
                    ctx.db,
                    profileFrom("olan@annen.no", "olan@annen.no"),
                ),
            ).toBeNull();
            expect(
                await resolveMigratedEmail(
                    ctx.db,
                    profileFrom("olan@ntnu.no", "olan@stud.ntnu.no"),
                ),
            ).toBe("privat@example.org");
        },
    );

    integrationTest(
        "does not link itself to an account through a matching address",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser("delt@example.org");

            const result = await signInWithFeide(
                ctx,
                profileFrom("noen@annen.no", "delt@example.org"),
            );

            expect(result.error).toBe("account not linked");
            expect(await feideLinksOf(ctx, member.id)).toHaveLength(0);
        },
    );

    integrationTest(
        "cannot claim a verified address on a login with no Feide id",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser("delt@example.org");

            const result = await signInWithFeide(ctx, {
                sub: `feide-sub-${crypto.randomUUID()}`,
                name: "Test Person",
                email: "delt@example.org",
                [USERID_SEC]: [],
            });

            expect(result.error).toBe("account not linked");
            expect(await feideLinksOf(ctx, member.id)).toHaveLength(0);
        },
    );
});

describe("a Feide login from NTNU", () => {
    integrationTest("links through a matching address", async ({ ctx }) => {
        const member = await ctx.utils.createTestUser("olan@stud.ntnu.no");

        const result = await signInWithFeide(
            ctx,
            profileFrom("olan@ntnu.no", "olan@stud.ntnu.no"),
        );

        expect(result.error).toBeFalsy();
        expect(await feideLinksOf(ctx, member.id)).toHaveLength(1);
    });

    integrationTest("links a migrated member by username", async ({ ctx }) => {
        const member = await ctx.utils.createTestUser("privat@example.org");
        await ctx.db
            .update(schema.user)
            .set({ username: "olan", displayUsername: "olan" })
            .where(eq(schema.user.id, member.id));

        const result = await signInWithFeide(
            ctx,
            profileFrom("olan@ntnu.no", "olan@stud.ntnu.no"),
        );

        expect(result.error).toBeFalsy();
        expect(await feideLinksOf(ctx, member.id)).toHaveLength(1);
    });
});
