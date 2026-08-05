import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * POST /api/user/me/password — the password a Feide account never had.
 *
 * Better Auth has no endpoint for this: `/change-password` requires the
 * current password, and `/reset-password` requires a token from an email. A
 * member who signed up through Feide has neither, so the session is the proof
 * of ownership here — the same thing the emailed token stands for.
 *
 * Adding only. Replacing a password that exists stays with the flows that ask
 * for the old one.
 */

/**
 * Turn a test user into what a Feide sign-up produces: a session, and no
 * credential row behind it. Must run *after* `clientForUser`, which signs in
 * with the very password being removed.
 */
const dropCredentialAccount = (ctx: IntegrationTestContext, userId: string) =>
    ctx.db
        .delete(schema.account)
        .where(
            and(
                eq(schema.account.userId, userId),
                eq(schema.account.providerId, "credential"),
            ),
        );

describe("POST /api/user/me/password", () => {
    integrationTest("rejects a caller without a session", async ({ ctx }) => {
        const client = ctx.utils.client();
        const res = await client.api.user.me.password.$post({
            json: { newPassword: "et-langt-passord" },
        });

        expect(res.status).toBe(401);
    });

    integrationTest(
        "adds a credential account the member can sign in with",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await dropCredentialAccount(ctx, user.id);

            const res = await client.api.user.me.password.$post({
                json: { newPassword: "et-langt-passord" },
            });

            expect(res.status).toBe(200);

            const accounts = await ctx.db
                .select({ password: schema.account.password })
                .from(schema.account)
                .where(
                    and(
                        eq(schema.account.userId, user.id),
                        eq(schema.account.providerId, "credential"),
                    ),
                );

            expect(accounts).toHaveLength(1);
            expect(accounts[0]?.password).toBeTruthy();

            // The point of the whole route: the password actually signs them
            // in. Asserting the stored value would prove nothing here — the
            // test harness hashes with the identity function on purpose.
            const signIn = await ctx.auth.api.signInEmail({
                body: { email: user.email, password: "et-langt-passord" },
            });
            expect(signIn.user.id).toBe(user.id);
        },
    );

    integrationTest(
        "refuses to overwrite a password that already exists",
        async ({ ctx }) => {
            // createTestUser signs the user up with a password, so this is the
            // account that already has one.
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const res = await client.api.user.me.password.$post({
                json: { newPassword: "et-annet-passord" },
            });

            expect(res.status).toBe(409);
        },
    );

    integrationTest("rejects a password that is too short", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();
        const client = await ctx.utils.clientForUser(user);
        await dropCredentialAccount(ctx, user.id);

        const res = await client.api.user.me.password.$post({
            json: { newPassword: "kort" },
        });

        expect(res.status).toBe(400);
    });
});
