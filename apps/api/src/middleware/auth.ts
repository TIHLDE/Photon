import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth, type Session, type User } from "~/lib/auth/auth";

type AuthVariables = {
    user: User;
    session: Session;
};

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
