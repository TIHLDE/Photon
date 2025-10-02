import { createMiddleware } from "hono/factory";
import { type Session, type User, auth } from "~/lib/auth";

export const session = createMiddleware<{
    Variables: {
        user: User | null;
        session: Session | null;
    };
}>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
        c.set("user", null);
        c.set("session", null);
        return next();
    }

    c.set("user", session.user);
    c.set("session", session.session);
    return next();
});
