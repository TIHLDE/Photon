import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";

type Variables = {
    user: User | null;
    session: Session | null;
};

export const requireAuth = createMiddleware<{ Variables: Variables }>(
    async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        await next();
    },
);
