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
import {
    hasPermission,
    hasScopedPermission,
} from "~/lib/auth/rbac/permissions";
import type { AppContext } from "~/lib/ctx";
import { describeMiddleware } from "~/lib/openapi";

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
 * Formats the permission description for OpenAPI documentation.
 */
function formatPermissionDescription(options: RequireAccessOptions): string {
    const perms = Array.isArray(options.permission)
        ? options.permission
        : [options.permission];

    const permStr =
        perms.length === 1
            ? `'${perms[0]}' permission`
            : `one of: ${perms.map((p) => `'${p}'`).join(", ")}`;

    const scopeStr = options.scope ? " (global or scoped)" : "";

    if (options.ownership) {
        return `Resource owner OR ${permStr}${scopeStr}`;
    }
    return `Requires ${permStr}${scopeStr}`;
}

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
export const requireAccess = (options: RequireAccessOptions) => {
    const permissions = Array.isArray(options.permission)
        ? options.permission
        : [options.permission];

    const middleware = createMiddleware<{ Variables: Variables }>(
        async (c, next) => {
            const user = c.get("user");

            if (!user) {
                throw new HTTPException(401, {
                    message: "Authentication required",
                });
            }

            const ctx = c.get("ctx");

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

            // 2. Check permissions (functions accept string | string[])
            let hasAccess = false;

            if (options.scope) {
                // Scoped permission check (global OR scoped)
                const scope = options.scope(c);
                hasAccess = await hasScopedPermission(
                    ctx,
                    user.id,
                    options.permission,
                    scope,
                );
            } else {
                // Global permission check only
                hasAccess = await hasPermission(
                    ctx,
                    user.id,
                    options.permission,
                );
            }

            if (!hasAccess) {
                const permStr = Array.isArray(options.permission)
                    ? options.permission.join(" or ")
                    : options.permission;
                const scopeStr = options.scope ? " (globally or scoped)" : "";
                throw new HTTPException(403, {
                    message: `Forbidden - requires permission: ${permStr}${scopeStr}`,
                });
            }

            c.set("isResourceOwner", false);
            await next();
        },
    );

    // Attach OpenAPI metadata to the middleware
    // Note: We don't add security here since requireAuth already adds it,
    // and requireAccess always requires authentication (throws 401 if no user)
    return describeMiddleware(middleware, {
        responses: {
            "403": { description: formatPermissionDescription(options) },
        },
        "x-permissions": {
            required: permissions,
            logic: permissions.length > 1 ? "any" : "all",
            scoped: !!options.scope,
            ownershipBypass: !!options.ownership,
        },
    } as Parameters<typeof describeMiddleware>[1]);
};
