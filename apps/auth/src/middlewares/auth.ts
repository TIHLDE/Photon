import { createMiddleware } from "hono/factory";
import { validateAndRenewSession } from "@/lib/session";
import type { InferSelectModel } from "drizzle-orm";
import type { sessions, users } from "@/db/schema";

type User = InferSelectModel<typeof users>
type Session = InferSelectModel<typeof sessions>

interface SessionWithUser extends Session {
    user: User;
}

interface AuthBindings {
    Variables: {
        session: SessionWithUser | undefined
    }
}

export const auth = createMiddleware<AuthBindings>(async (c, next) => {
    const session = await validateAndRenewSession(c)
    c.set('session', session)

    await next()
})