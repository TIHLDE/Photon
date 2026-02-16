import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AuthInstance, Session, User } from "../index";

type AuthVariables = {
    user: User;
    session: Session;
    ctx: { auth: AuthInstance; [key: string]: unknown };
};

/**
 * Requires that the user is authenticated to access the endpoint.
 * `user` and `session` will be made available to the route handler
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
    async (c, next) => {
        const { auth } = c.get("ctx");
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        if (!session) {
            throw new HTTPException(401, {
                message: "Unauthorized",
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
    Variables: Partial<AuthVariables> & {
        ctx: { auth: AuthInstance; [key: string]: unknown };
    };
}>(async (c, next) => {
    const { auth } = c.get("ctx");
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
