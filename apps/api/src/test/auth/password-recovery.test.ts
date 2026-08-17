import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * The recovery path for a member who has no TIHLDE password.
 *
 * This is the question "password as the default login" rests on: 17 members in
 * production have only a Feide account, and 215 more carry the Lepton
 * migration's placeholder — a value nobody knows, which `/user/me/password`
 * refuses to overwrite while it is there. Both groups are pointed at "Glemt
 * passord", so if `requestPasswordReset` quietly does nothing for an account
 * with no `credential` row, that banner points at a dead end.
 *
 * The endpoint is no help on its own: it answers 200 with "If this email
 * exists in our system…" whether or not it did anything, precisely so it
 * cannot be used to enumerate addresses. Asserting on the status proves
 * nothing — whether the mail is actually sent is the real signal.
 */
describe("password recovery without a chosen password", () => {
    integrationTest(
        "a member with no credential account still gets a reset mail",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();

            // The state a Feide-only member is in: verified address, and no
            // password row anywhere.
            await ctx.db
                .update(schema.user)
                .set({ emailVerified: true })
                .where(eq(schema.user.id, user.id));
            await ctx.db
                .delete(schema.account)
                .where(eq(schema.account.userId, user.id));

            const sendReset = vi.spyOn(ctx.email, "sendPasswordResetMail");

            const response = await requestReset(ctx, user.email);
            expect(response.status).toBe(200);

            expect(sendReset).toHaveBeenCalledWith(
                expect.objectContaining({ to: user.email }),
            );
        },
    );

    integrationTest(
        "a member who already has a password also gets one",
        async ({ ctx }) => {
            // The control: proves the spy would have caught a send, so a
            // failure above can only mean the mail never happened.
            const user = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ emailVerified: true })
                .where(eq(schema.user.id, user.id));

            const sendReset = vi.spyOn(ctx.email, "sendPasswordResetMail");

            await requestReset(ctx, user.email);

            expect(sendReset).toHaveBeenCalledWith(
                expect.objectContaining({ to: user.email }),
            );
        },
    );
});

/**
 * Better Auth's routes are mounted as a catch-all, so the typed Hono client
 * does not know them — hence the raw request rather than `ctx.utils.client()`.
 */
function requestReset(ctx: IntegrationTestContext, email: string) {
    return ctx.app.request(`${env.ROOT_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
    });
}
