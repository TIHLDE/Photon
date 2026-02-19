import { schema } from "@photon/db";
import type { TestUtilContext } from ".";

export const createCreateTestUser =
    (ctx: TestUtilContext) => async (email?: string) => {
        const password = "abc123!";
        const testEmail = email || `test-${crypto.randomUUID()}@test.com`;

        const data = await ctx.auth.api.createUser({
            body: {
                email: testEmail,
                name: "Brotherman Testern",
                password,
            },
        });

        // Make sure email verified is true
        await ctx.db.update(schema.user).set({
            emailVerified: true,
        });

        return { ...data.user, password };
    };
