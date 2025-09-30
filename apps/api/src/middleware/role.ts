import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";
import { userHasAnyRoleName, userHasRoleName } from "~/lib/auth/rbac";
import type { AppContext } from "../lib/context";

type Variables = {
    user: User | null;
    session: Session | null;
    services: AppContext;
};

export const requireRoles = (...roles: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasAllRoles = await Promise.all(
            roles.map((name) =>
                userHasRoleName(c.get("services"), user.id, name),
            ),
        ).then((results) => results.every(Boolean));

        if (!hasAllRoles) {
            throw new HTTPException(403, {
                message: `Missing required roles: ${roles.join(", ")}`,
            });
        }

        await next();
    });

export const requireAnyRole = (...roles: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasRole = await userHasAnyRoleName(
            c.get("services"),
            user.id,
            roles,
        );

        if (!hasRole) {
            throw new HTTPException(403, {
                message: `Missing required roles. Need one of: ${roles.join(", ")}`,
            });
        }

        await next();
    });
