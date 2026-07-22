import { feideUsernameOf, resolveMigratedEmail } from "@photon/auth/feide";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { integrationTest } from "~/test/config/integration";

const USERID_SEC = "https://n.feide.no/claims/userid_sec";

const profileFor = (username: string) => ({
    sub: `feide-sub-${username}`,
    name: "Test Person",
    email: `${username}@stud.ntnu.no`,
    [USERID_SEC]: [`feide:${username}@ntnu.no`],
});

describe("feideUsernameOf", () => {
    it("extracts the local part of the feide principal", () => {
        expect(
            feideUsernameOf({ [USERID_SEC]: ["feide:mathstr@ntnu.no"] }),
        ).toBe("mathstr");
    });

    it("skips non-feide identifiers and lowercases the result", () => {
        expect(
            feideUsernameOf({
                [USERID_SEC]: ["nin:01010112345", "feide:MathStr@ntnu.no"],
            }),
        ).toBe("mathstr");
    });

    it("returns null when the claim is missing or has no feide entry", () => {
        expect(feideUsernameOf({})).toBeNull();
        expect(feideUsernameOf({ [USERID_SEC]: ["nin:010101"] })).toBeNull();
    });
});

/**
 * Most migrated members registered in Lepton with a personal address, so
 * Better Auth's email-based OAuth matching would miss them and mint a second,
 * empty account. These cover the username bridge that prevents that.
 */
describe("resolveMigratedEmail", () => {
    integrationTest(
        "returns the stored email for a migrated user without a Feide link",
        async ({ ctx }) => {
            // A migrated member: Lepton had a gmail address, and the import
            // stored the Lepton user_id as username.
            const user = await ctx.utils.createTestUser(
                "personal-address@gmail.com",
            );
            await ctx.db
                .update(schema.user)
                .set({ username: "mathstr", displayUsername: "mathstr" })
                .where(eq(schema.user.id, user.id));

            const email = await resolveMigratedEmail(
                ctx.db,
                profileFor("mathstr"),
            );

            expect(email).toBe("personal-address@gmail.com");
        },
    );

    integrationTest(
        "returns null once the user already has a Feide link",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser(
                "linked-user@gmail.com",
            );
            await ctx.db
                .update(schema.user)
                .set({ username: "linked", displayUsername: "linked" })
                .where(eq(schema.user.id, user.id));
            await ctx.db.insert(schema.account).values({
                id: crypto.randomUUID(),
                userId: user.id,
                providerId: "feide",
                accountId: "feide-sub-linked",
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // From the second login on, the provider/sub pair identifies the
            // user — and the guard is what keeps a hand-picked Lepton username
            // from capturing someone else's NTNU username.
            const email = await resolveMigratedEmail(
                ctx.db,
                profileFor("linked"),
            );

            expect(email).toBeNull();
        },
    );

    integrationTest(
        "returns null when no user carries the username",
        async ({ ctx }) => {
            const email = await resolveMigratedEmail(
                ctx.db,
                profileFor("ukjentbruker"),
            );

            expect(email).toBeNull();
        },
    );

    integrationTest(
        "returns null when the profile has no principal claim",
        async ({ ctx }) => {
            const email = await resolveMigratedEmail(ctx.db, {
                sub: "feide-sub-x",
                name: "Uten Claim",
                email: "x@stud.ntnu.no",
            });

            expect(email).toBeNull();
        },
    );
});
