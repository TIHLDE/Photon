import type { TestUtilContext } from ".";
import { schema } from "../../../../db";

export const createCreateTestUser = (ctx: TestUtilContext) => async () => {
    const password = "abc123!";

    const data = await ctx.auth.api.createUser({
        body: {
            email: "test@test.com",
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
