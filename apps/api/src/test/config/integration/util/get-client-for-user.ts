import type { UserWithRole } from "better-auth/plugins";
import { testClient } from "hono/testing";
import type { TestUtilContext } from ".";

export const createGetClientForUser =
    (ctx: TestUtilContext) =>
    async (user: UserWithRole & { password: string }) => {
        const response = await ctx.auth.api.signInEmail({
            body: {
                email: user.email,
                password: user.password,
            },
            returnHeaders: true,
        });

        const token = response.headers;
        const cookie = response.headers.getSetCookie()[0]?.split(";")[0];

        if (!cookie) {
            throw new Error("Invalid cookies returned by auth call");
        }

        return testClient(ctx.app, undefined, undefined, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                Cookie: cookie,
            },
        });
    };
