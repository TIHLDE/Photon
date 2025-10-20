/**
 * Permission-based middleware for protecting routes.
 * Checks if the authenticated user has the required permissions.
 */

import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";
import {
    hasAllPermissions,
    hasAnyPermission,
    hasPermission,
} from "~/lib/auth/rbac/permissions";
import type { AppContext } from "../lib/ctx";

type Variables = {
    user: User | null;
    session: Session | null;
    ctx: AppContext;
};

/**
 * Middleware to require a single permission.
 * Throws 401 if not authenticated, 403 if missing permission.
 *
 * @example
 * app.delete('/events/:id', requirePermission('events:delete'), async (c) => { ... })
 */
export const requirePermission = (permissionName: string) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasPerm = await hasPermission(
            c.get("ctx"),
            user.id,
            permissionName,
        );

        if (!hasPerm) {
            throw new HTTPException(403, {
                message: `Missing required permission: ${permissionName}`,
            });
        }

        await next();
    });

/**
 * Middleware to require ANY of the provided permissions.
 * User needs at least one of the listed permissions.
 *
 * @example
 * app.post('/events', requireAnyPermission('events:create', 'events:manage'), async (c) => { ... })
 */
export const requireAnyPermission = (...permissions: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasPerm = await hasAnyPermission(
            c.get("ctx"),
            user.id,
            permissions,
        );

        if (!hasPerm) {
            throw new HTTPException(403, {
                message: `Missing required permissions. Need one of: ${permissions.join(", ")}`,
            });
        }

        await next();
    });

/**
 * Middleware to require ALL of the provided permissions.
 * User needs every single listed permission.
 *
 * @example
 * app.post('/admin/users', requireAllPermissions('users:create', 'users:manage'), async (c) => { ... })
 */
export const requireAllPermissions = (...permissions: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasPerms = await hasAllPermissions(
            c.get("ctx"),
            user.id,
            permissions,
        );

        if (!hasPerms) {
            throw new HTTPException(403, {
                message: `Missing required permissions: ${permissions.join(", ")}`,
            });
        }

        await next();
    });

// Backwards-compatible aliases
export const requirePermissions = requireAllPermissions;
export const withPermissionCheck = requirePermission;
