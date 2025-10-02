import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";
import {
    userHasAllPermissions,
    userHasAnyPermissionName,
    userHasPermissionName,
} from "~/lib/auth/rbac";
import type { AppContext } from "../lib/ctx";

type Variables = {
    user: User | null;
    session: Session | null;
    ctx: AppContext;
};

export const requirePermissions = (...permissions: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasPermissions = await userHasAllPermissions(
            c.get("ctx"),
            user.id,
            permissions,
        );

        if (!hasPermissions) {
            throw new HTTPException(403, {
                message: `Missing required permissions: ${permissions.join(", ")}`,
            });
        }

        await next();
    });

export const requireAnyPermission = (...permissions: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasPermission = await userHasAnyPermissionName(
            c.get("ctx"),
            user.id,
            permissions,
        );

        if (!hasPermission) {
            throw new HTTPException(403, {
                message: `Missing required permissions. Need one of: ${permissions.join(", ")}`,
            });
        }

        await next();
    });

export const withPermissionCheck = (permissionName: string) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasPermission = await userHasPermissionName(
            c.get("ctx"),
            user.id,
            permissionName,
        );

        if (!hasPermission) {
            throw new HTTPException(403, {
                message: `Missing required permission: ${permissionName}`,
            });
        }

        await next();
    });
