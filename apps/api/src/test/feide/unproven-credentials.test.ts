import {
    passwordSetupRedirect,
    revokeUnprovenCredentials,
} from "@photon/auth/feide";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { integrationTest } from "~/test/config/integration";

const FRONTEND = "https://tihlde.org";

const credentialsOf = (
    db: Parameters<typeof revokeUnprovenCredentials>[0],
    userId: string,
) =>
    db
        .select({ id: schema.account.id })
        .from(schema.account)
        .where(
            and(
                eq(schema.account.userId, userId),
                eq(schema.account.providerId, "credential"),
            ),
        );

/**
 * Anyone may register `<username>@stud.ntnu.no` without proving they own it,
 * so an unverified account is evidence of nothing. These cover the rule that
 * stops a password planted on such an account from surviving the Feide login
 * that would otherwise verify — and thereby arm — it.
 *
 * Note that `createTestUser` verifies every row in the table, so each case sets
 * the flag it actually wants afterwards, scoped to its own user.
 */
describe("revokeUnprovenCredentials", () => {
    integrationTest(
        "deletes the password and every session of an unverified account",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser("planted@stud.ntnu.no");
            await ctx.db
                .update(schema.user)
                .set({ emailVerified: false })
                .where(eq(schema.user.id, user.id));

            await ctx.db.insert(schema.session).values({
                id: crypto.randomUUID(),
                userId: user.id,
                token: crypto.randomUUID(),
                expiresAt: new Date(Date.now() + 60_000),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const revoked = await revokeUnprovenCredentials(ctx.db, user.id);

            expect(revoked).toBe(true);
            expect(await credentialsOf(ctx.db, user.id)).toHaveLength(0);

            const sessions = await ctx.db
                .select({ id: schema.session.id })
                .from(schema.session)
                .where(eq(schema.session.userId, user.id));
            expect(sessions).toHaveLength(0);
        },
    );

    integrationTest(
        "leaves a verified account's password alone",
        async ({ ctx }) => {
            // Proving the mailbox is what makes the password theirs, and that
            // proof has already happened — linking Feide must not undo it.
            const user = await ctx.utils.createTestUser("proven@stud.ntnu.no");
            await ctx.db
                .update(schema.user)
                .set({ emailVerified: true })
                .where(eq(schema.user.id, user.id));

            const revoked = await revokeUnprovenCredentials(ctx.db, user.id);

            expect(revoked).toBe(false);
            expect(await credentialsOf(ctx.db, user.id)).toHaveLength(1);
        },
    );

    integrationTest(
        "reports nothing revoked when there was no password to take",
        async ({ ctx }) => {
            // The ordinary first Feide login for a brand-new member: no
            // credential row exists, so there is nothing to revoke — and the
            // member must not be told their password was removed.
            const user = await ctx.utils.createTestUser(
                "feide-only@stud.ntnu.no",
            );
            await ctx.db
                .update(schema.user)
                .set({ emailVerified: false })
                .where(eq(schema.user.id, user.id));
            await ctx.db
                .delete(schema.account)
                .where(eq(schema.account.userId, user.id));

            const revoked = await revokeUnprovenCredentials(ctx.db, user.id);

            expect(revoked).toBe(false);
        },
    );

    integrationTest(
        "does nothing for a user that no longer exists",
        async ({ ctx }) => {
            const revoked = await revokeUnprovenCredentials(
                ctx.db,
                "no-such-user",
            );

            expect(revoked).toBe(false);
        },
    );
});

/**
 * Losing a password silently is how someone finds out on the day Feide is down
 * and the password form is the only way in. These cover where they get sent
 * instead.
 */
describe("passwordSetupRedirect", () => {
    it("carries the original destination along", () => {
        expect(
            passwordSetupRedirect("https://tihlde.org/arrangementer", FRONTEND),
        ).toBe("https://tihlde.org/velg-passord?redirectTo=%2Farrangementer");
    });

    it("keeps the query string of where they were headed", () => {
        expect(
            passwordSetupRedirect(
                "https://tihlde.org/arrangementer?side=2",
                FRONTEND,
            ),
        ).toBe(
            "https://tihlde.org/velg-passord?redirectTo=%2Farrangementer%3Fside%3D2",
        );
    });

    it("refuses to carry a destination on another origin", () => {
        // An off-site location is either an error URL or something we should
        // not be bouncing a signed-in member through.
        expect(
            passwordSetupRedirect("https://example.com/whatever", FRONTEND),
        ).toBe("https://tihlde.org/velg-passord?redirectTo=%2F");
    });

    it("leaves the redirect alone when it already points at the setup page", () => {
        // A first-ever Feide login gets there on its own via
        // `newUserCallbackURL`; rewriting would nest redirectTo into itself.
        expect(
            passwordSetupRedirect(
                "https://tihlde.org/velg-passord?redirectTo=%2F",
                FRONTEND,
            ),
        ).toBeNull();
    });

    it("gives up on a location it cannot parse", () => {
        expect(passwordSetupRedirect("not-a-url", FRONTEND)).toBeNull();
    });
});
