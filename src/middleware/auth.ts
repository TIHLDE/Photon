import { createMiddleware } from "hono/factory";
import type { Session, User } from "~/lib/auth";
import { describeMiddleware, describeMiddlewareRoute } from "~/lib/openapi";
import type { AppContext } from "../lib/ctx";

import { HTTPAppException } from "~/lib/errors";

type AuthVariables = {
    user: User;
    session: Session;
    ctx: AppContext;
};

/**
 * Requires that the user is authenticated to access the endpoint.
 * `user` and `session` will be made available to the route handler
 */
export const requireAuth = describeMiddleware(
    createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
        const { auth } = c.get("ctx");
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        if (!session) {
            throw HTTPAppException.Unauthorized();
        }

        c.set("user", session.user);
        c.set("session", session.session);

        await next();
    }),
    {
        security: [{ bearerAuth: [] }],
        ...describeMiddlewareRoute()
            .errorResponses([HTTPAppException.Unauthorized()])
            .getSpec(),
    },
);

/**
 * Does not require the user to be authenticated, but if they are,
 * `user` and `session` will be made available to the route handler
 */
export const captureAuth = createMiddleware<{
    Variables: Partial<AuthVariables> & { ctx: AppContext };
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
