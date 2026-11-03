import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

async function signedInAdminRole(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    await ctx.db
        .update(schema.user)
        .set({ role: "admin" })
        .where(eq(schema.user.id, user.id));
    const signIn = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });
    const cookie = signIn.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    return { user, cookie };
}

describe("Better Auth's admin routes", () => {
    integrationTest(
        "are closed over HTTP, also for an account with the admin role",
        async ({ ctx }) => {
            const { cookie } = await signedInAdminRole(ctx);
            const target = await ctx.utils.createTestUser();
            const headers = {
                "Content-Type": "application/json",
                Cookie: cookie,
            };

            for (const path of [
                "/api/auth/admin/list-users",
                "/api/auth//admin/list-users",
            ]) {
                const res = await ctx.app.request(path, { headers });
                expect(res.status, path).toBe(404);
            }

            for (const [route, body] of [
                [
                    "set-user-password",
                    { userId: target.id, newPassword: "et-nytt-passord-1" },
                ],
                ["impersonate-user", { userId: target.id }],
                ["set-role", { userId: target.id, role: "admin" }],
                ["remove-user", { userId: target.id }],
            ] as const) {
                const res = await ctx.app.request(`/api/auth/admin/${route}`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                });
                expect(res.status, route).toBe(404);
            }

            await expect(
                ctx.auth.api.signInEmail({
                    body: {
                        email: target.email,
                        password: "et-nytt-passord-1",
                    },
                }),
            ).rejects.toThrow();
            await expect(
                ctx.auth.api.signInEmail({
                    body: { email: target.email, password: target.password },
                }),
            ).resolves.toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "banned users are still refused at sign-in",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ banned: true })
                .where(eq(schema.user.id, user.id));

            await expect(
                ctx.auth.api.signInEmail({
                    body: { email: user.email, password: user.password },
                }),
            ).rejects.toThrow();
        },
        500_000,
    );
});
