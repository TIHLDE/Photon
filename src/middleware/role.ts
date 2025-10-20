/**
 * Role-based middleware for protecting routes.
 *
 * ⚠️ NOTE: In most cases, you should use permission-based checks instead!
 * Roles are containers for permissions. Check permissions, not roles.
 *
 * These middlewares are only useful for:
 * - Special role-specific UI/features
 * - Role management endpoints
 * - Cases where you specifically need role membership checks
 *
 * For access control, use: requirePermission() from permission.ts
 */

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";
import {
    getUserHighestRolePosition,
    userHasAnyRole,
    userHasRole,
} from "~/lib/auth/rbac/roles";
import type { AppContext } from "../lib/ctx";

type Variables = {
    user: User | null;
    session: Session | null;
    ctx: AppContext;
};

/**
 * Middleware to require a single role.
 *
 * ⚠️ Rarely needed - prefer permission checks!
 *
 * @example
 * app.get('/admin-dashboard', requireRole('admin'), async (c) => { ... })
 */
export const requireRole = (roleName: string) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasRole = await userHasRole(c.get("ctx"), user.id, roleName);

        if (!hasRole) {
            throw new HTTPException(403, {
                message: `Missing required role: ${roleName}`,
            });
        }

        await next();
    });

/**
 * Middleware to require ANY of the provided roles.
 *
 * ⚠️ Rarely needed - prefer permission checks!
 *
 * @example
 * app.get('/moderator-tools', requireAnyRole('admin', 'moderator'), async (c) => { ... })
 */
export const requireAnyRole = (...roles: string[]) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const hasRole = await userHasAnyRole(c.get("ctx"), user.id, roles);

        if (!hasRole) {
            throw new HTTPException(403, {
                message: `Missing required roles. Need one of: ${roles.join(", ")}`,
            });
        }

        await next();
    });

/**
 * Middleware to check if current user can manage a target role based on hierarchy.
 * Useful for role management endpoints.
 *
 * A user can manage a role only if they have a strictly higher role position (lower number).
 *
 * @example
 * app.put('/roles/:id', requireRoleManagement(async (c) => {
 *     const roleId = Number(c.req.param('id'));
 *     const role = await getRoleById(roleId);
 *     return role.position;
 * }), async (c) => { ... })
 */
export const requireRoleManagement = (
    getTargetRolePosition: (
        c: Context<{ Variables: Variables }>,
    ) => Promise<number>,
) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const managerPos = await getUserHighestRolePosition(
            c.get("ctx"),
            user.id,
        );
        if (managerPos === null) {
            throw new HTTPException(403, {
                message: "Insufficient role hierarchy",
            });
        }

        const targetPos = await getTargetRolePosition(c);

        // Lower position number = higher in hierarchy
        // Must be strictly higher to prevent siblings from managing each other
        if (!(managerPos < targetPos)) {
            throw new HTTPException(403, {
                message: "You cannot manage this role",
            });
        }

        await next();
    });
