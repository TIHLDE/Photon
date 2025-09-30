import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type Session, type User, auth } from "~/lib/auth";

type AuthVariables = {
    user: User;
    session: Session;
};

/**
 * Requires that the user is authenticated to access the endpoint.
 * `user` and `session` will be made available to the route handler
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
    async (c, next) => {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        if (!session) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        c.set("user", session.user);
        c.set("session", session.session);

        await next();
    },
);

/**
 * Does not require the user to be authenticated, but if they are,
 * `user` and `session` will be made available to the route handler
 */
export const captureAuth = createMiddleware<{
    Variables: Partial<AuthVariables>;
}>(async (c, next) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session) {
        await next();
        return;
    }

    c.set("user", session.user);
    c.set("session", session.session);

    await next();
});
