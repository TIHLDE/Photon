import { env } from "@photon/core/env";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

async function updateUser(
    ctx: IntegrationTestContext,
    user: { email: string; password: string },
    body: Record<string, unknown>,
) {
    const signedIn = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });
    const cookie = signedIn.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");

    return ctx.app.request(`${env.ROOT_URL}/api/auth/update-user`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
            Origin: env.ROOT_URL,
        },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/update-user", () => {
    for (const body of [
        { username: "enannen" },
        { displayUsername: "enannen" },
        { name: "Nytt Navn", username: "enannen" },
    ]) {
        integrationTest(
            `refuses ${Object.keys(body).join(" + ")}`,
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                await ctx.db
                    .update(schema.user)
                    .set({ username: "original", displayUsername: "original" })
                    .where(eq(schema.user.id, user.id));

                const res = await updateUser(ctx, user, body);

                expect(res.status).toBe(400);

                const [row] = await ctx.db
                    .select()
                    .from(schema.user)
                    .where(eq(schema.user.id, user.id));
                expect(row?.username).toBe("original");
                expect(row?.displayUsername).toBe("original");
                expect(row?.name).toBe(user.name);
            },
        );
    }

    integrationTest(
        "still lets a member change their name",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();

            const res = await updateUser(ctx, user, { name: "Nytt Navn" });

            expect(res.status).toBe(200);

            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, user.id));
            expect(row?.name).toBe("Nytt Navn");
        },
    );
});
