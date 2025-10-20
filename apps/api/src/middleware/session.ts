import { createMiddleware } from "hono/factory";
import type { Session, User } from "~/lib/auth";
import type { AppContext } from "../lib/ctx";

export const session = createMiddleware<{
    Variables: {
        user: User | null;
        session: Session | null;
        ctx: AppContext;
    };
}>(async (c, next) => {
    const { auth } = c.get("ctx");
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
