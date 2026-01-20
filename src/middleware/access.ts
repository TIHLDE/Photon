/**
 * Unified access control middleware.
 *
 * Replaces the scattered permission/ownership middlewares with a single,
 * composable middleware that handles all access control patterns:
 * - Global permissions
 * - Scoped permissions
 * - Resource ownership
 *
 * @example
 * // Simple permission check
 * requireAccess({ permission: 'events:view' })
 *
 * // Any of multiple permissions
 * requireAccess({ permission: ['events:update', 'events:manage'] })
 *
 * // Scoped permission (global OR scoped)
 * requireAccess({
 *   permission: 'groups:update',
 *   scope: (c) => `group:${c.req.param('slug')}`
 * })
 *
 * // Owner OR permission
 * requireAccess({
 *   permission: ['jobs:update', 'jobs:manage'],
 *   scope: (c) => `job-${c.req.param('id')}`,
 *   ownership: { param: 'id', check: isJobCreator }
 * })
 */

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";
import { hasAnyPermission, hasPermission } from "~/lib/auth/rbac/permissions";
import { hasScopedPermission } from "~/lib/auth/rbac/roles";
import type { AppContext } from "~/lib/ctx";

type Variables = {
    user: User | null;
    session: Session | null;
    ctx: AppContext;
    isResourceOwner?: boolean;
};

/**
 * Function that checks if a user owns/created a resource.
 */
export type OwnershipChecker = (
    ctx: AppContext,
    resourceId: string,
    userId: string,
) => Promise<boolean>;

/**
 * Options for the requireAccess middleware.
 */
export type RequireAccessOptions = {
    /**
     * Permission(s) required. If array, user needs ANY of them.
     */
    permission: string | string[];

    /**
     * Optional scope resolver. If provided, checks both global and scoped permissions.
     * If not provided, only checks global permissions.
     */
    scope?: (c: Context<{ Variables: Variables }>) => string;

    /**
     * Optional ownership check. If provided, owner bypasses permission check.
     */
    ownership?: {
        /** Route parameter name for the resource ID */
        param: string;
        /** Function to check if user owns the resource */
        check: OwnershipChecker;
    };
};

/**
 * Unified access control middleware.
 *
 * Logic flow:
 * 1. If ownership is configured and user is owner → Allow
 * 2. If scope is configured → Check global OR scoped permission
 * 3. Otherwise → Check global permission only
 *
 * For multiple permissions, user needs ANY of them (not all).
 */
export const requireAccess = (options: RequireAccessOptions) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const ctx = c.get("ctx");
        const permissions = Array.isArray(options.permission)
            ? options.permission
            : [options.permission];

        // 1. Check ownership first (if configured)
        if (options.ownership) {
            const resourceId = c.req.param(options.ownership.param);
            if (!resourceId) {
                throw new HTTPException(400, {
                    message: `Resource ID parameter '${options.ownership.param}' required`,
                });
            }

            const isOwner = await options.ownership.check(
                ctx,
                resourceId,
                user.id,
            );
            if (isOwner) {
                c.set("isResourceOwner", true);
                await next();
                return;
            }
        }

        // 2. Check permissions
        let hasAccess = false;

        if (options.scope) {
            // Scoped permission check (global OR scoped)
            const scope = options.scope(c);
            for (const perm of permissions) {
                if (await hasScopedPermission(ctx, user.id, perm, scope)) {
                    hasAccess = true;
                    break;
                }
            }
        } else {
            // Global permission check only
            const firstPermission = permissions[0];
            if (permissions.length === 1 && firstPermission) {
                hasAccess = await hasPermission(ctx, user.id, firstPermission);
            } else {
                hasAccess = await hasAnyPermission(ctx, user.id, permissions);
            }
        }

        if (!hasAccess) {
            const permStr = permissions.join(" or ");
            const scopeStr = options.scope ? " (globally or scoped)" : "";
            throw new HTTPException(403, {
                message: `Forbidden - requires permission: ${permStr}${scopeStr}`,
            });
        }

        c.set("isResourceOwner", false);
        await next();
    });
