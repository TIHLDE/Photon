/**
 * Permission-based middleware for protecting routes.
 * Checks if the authenticated user has the required permissions.
 *
 * Supports:
 * - Global permissions (via roles or direct grants)
 * - Scoped permissions (e.g., "events:create" only for "group:fotball")
 * - Ownership-based access control
 */

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { Session, User } from "~/lib/auth";
import {
    hasAllPermissions,
    hasAnyPermission,
    hasPermission,
} from "~/lib/auth/rbac/permissions";
import { hasScopedPermission } from "~/lib/auth/rbac/roles";
import { HTTPAppException } from "~/lib/errors";
import { describeMiddleware, describeMiddlewareRoute } from "~/lib/openapi";
import type { AppContext } from "../lib/ctx";

type Variables = {
    user: User | null;
    session: Session | null;
    ctx: AppContext;
};

/**
 * Type for scope resolver functions.
 * Extracts the scope identifier from the request context.
 *
 * @example
 * const groupScope = (c) => `group:${c.req.param('groupSlug')}`
 * const eventScope = (c) => `event:${c.req.param('eventId')}`
 */
export type ScopeResolver = (c: Context) => string;

/**
 * Middleware to require a single permission.
 * Throws 401 if not authenticated, 403 if missing permission.
 *
 * @example
 * app.delete('/events/:id', requirePermission('events:delete'), async (c) => { ... })
 */
export const requirePermission = (permissionName: string) =>
    describeMiddleware(
        createMiddleware<{ Variables: Variables }>(async (c, next) => {
            const user = c.get("user");

            if (!user) {
                throw HTTPAppException.Unauthorized();
            }

            const hasPerm = await hasPermission(
                c.get("ctx"),
                user.id,
                permissionName,
            );

            if (!hasPerm) {
                throw new HTTPAppException({
                    status: 403,
                    message: `Missing required permission: ${permissionName}`,
                    meta: {
                        permission: permissionName,
                    },
                });
            }

            await next();
        }),
        describeMiddlewareRoute()
            .errorResponses([
                HTTPAppException.Unauthorized(),
                new HTTPAppException({
                    status: 403,
                    message: `Missing required permission: ${permissionName}`,
                }),
            ])
            .getSpec(),
    );

/**
 * Middleware to require ANY of the provided permissions.
 * User needs at least one of the listed permissions.
 *
 * @example
 * app.post('/events', requireAnyPermission('events:create', 'events:manage'), async (c) => { ... })
 */
export const requireAnyPermission = (...permissions: string[]) =>
    describeMiddleware(
        createMiddleware<{ Variables: Variables }>(async (c, next) => {
            const user = c.get("user");

            if (!user) {
                throw HTTPAppException.Unauthorized();
            }

            const hasPerm = await hasAnyPermission(
                c.get("ctx"),
                user.id,
                permissions,
            );

            if (!hasPerm) {
                throw new HTTPAppException({
                    status: 403,
                    message: `Missing required permissions. Need one of: ${permissions.join(", ")}`,
                    meta: {
                        permissions,
                    },
                });
            }

            await next();
        }),
        describeMiddlewareRoute()
            .errorResponses([
                HTTPAppException.Unauthorized(),
                new HTTPAppException({
                    status: 403,
                    message: `Missing required permissions. Need one of: ${permissions.join(", ")}`,
                }),
            ])
            .getSpec(),
    );

/**
 * Middleware to require ALL of the provided permissions.
 * User needs every single listed permission.
 *
 * @example
 * app.post('/admin/users', requireAllPermissions('users:create', 'users:manage'), async (c) => { ... })
 */
export const requireAllPermissions = (...permissions: string[]) =>
    describeMiddleware(
        createMiddleware<{ Variables: Variables }>(async (c, next) => {
            const user = c.get("user");

            if (!user) {
                throw new HTTPAppException({
                    status: 401,
                    message: "Authentication required",
                });
            }

            const hasPerms = await hasAllPermissions(
                c.get("ctx"),
                user.id,
                permissions,
            );

            if (!hasPerms) {
                throw new HTTPAppException({
                    status: 403,
                    message: `Missing required permissions: ${permissions.join(", ")}`,
                    meta: {
                        permissions,
                    },
                });
            }

            await next();
        }),
        describeMiddlewareRoute()
            .errorResponses([
                HTTPAppException.Unauthorized(),
                new HTTPAppException({
                    status: 403,
                    message: `Missing required permissions: ${permissions.join(", ")}`,
                }),
            ])
            .getSpec(),
    );

/**
 * Middleware to require a permission with optional scoping.
 * Checks if user has the permission globally OR scoped to a specific resource.
 *
 * This is the key middleware for attribute-based access control (ABAC).
 * Users can have permissions that are:
 * 1. Global (no scope) - can perform action on any resource
 * 2. Scoped (with scope) - can only perform action on specific resources
 *
 * @param permissionName - The permission to check (e.g., "events:create")
 * @param scopeResolver - Function to extract scope from request (e.g., `c => `group:${c.req.param('groupSlug')}`)
 *
 * @example
 * // User can create events if they have:
 * // - Global "events:create" permission, OR
 * // - "events:create" scoped to "group:fotball" (when creating event for fotball group)
 * app.post('/groups/:groupSlug/events',
 *     requireAuth,
 *     requireScopedPermission("events:create", (c) => `group:${c.req.param('groupSlug')}`),
 *     async (c) => { ... }
 * );
 *
 * @example
 * // Combine with ownership for more complex scenarios:
 * // User can update group if they are a leader OR have global groups:manage permission
 * app.put('/groups/:slug',
 *     requireAuth,
 *     requireScopedPermission("groups:update", (c) => `group:${c.req.param('slug')}`),
 *     requireOwnershipOrPermission("slug", isGroupLeader, "groups:manage"),
 *     async (c) => { ... }
 * );
 */
export const requireScopedPermission = (
    permissionName: string,
    scopeResolver: ScopeResolver,
) =>
    describeMiddleware(
        createMiddleware<{ Variables: Variables }>(async (c, next) => {
            const user = c.get("user");

            if (!user) {
                throw HTTPAppException.Unauthorized();
            }

            const ctx = c.get("ctx");
            const scope = scopeResolver(c);

            // Check if user has permission globally
            const hasGlobalPerm = await hasPermission(
                ctx,
                user.id,
                permissionName,
            );

            if (hasGlobalPerm) {
                // User has global permission, allow access
                await next();
                return;
            }

            // Check if user has scoped permission for this specific resource
            const hasScopedPerm = await hasScopedPermission(
                ctx,
                user.id,
                permissionName,
                scope,
            );

            if (!hasScopedPerm) {
                throw new HTTPAppException({
                    status: 403,
                    message: `Missing required permission: ${permissionName} for scope: ${scope}`,
                    meta: {
                        permission: permissionName,
                        scope,
                    },
                });
            }

            await next();
        }),
        describeMiddlewareRoute()
            .errorResponses([
                HTTPAppException.Unauthorized(),
                new HTTPAppException({
                    status: 403,
                    message: `Missing required permission: ${permissionName} for resource scope`,
                }),
            ])
            .getSpec(),
    );

// Backwards-compatible aliases
export const requirePermissions = requireAllPermissions;
export const withPermissionCheck = requirePermission;
