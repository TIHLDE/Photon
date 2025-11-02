/**
 * Ownership-based middleware for protecting resources.
 * Allows access if user is the resource owner OR has required permissions.
 * This is useful for operations where both the owner and admins should have access.
 */

import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Session, User } from "~/lib/auth";
import { hasAnyPermission, hasPermission } from "~/lib/auth/rbac/permissions";
import type { AppContext } from "~/lib/ctx";

type Variables = {
    user: User | null;
    session: Session | null;
    isResourceOwner?: boolean;
    ctx: AppContext;
};

/**
 * Type for resource ownership checker functions.
 * Should return true if the user owns/created the resource.
 *
 * @example
 * const isEventOwner: ResourceOwnershipChecker = async (eventId, userId) => {
 *     const event = await db.query.event.findFirst({ where: eq(event.id, eventId) });
 *     return event?.createdBy === userId;
 * };
 */
export type ResourceOwnershipChecker = (
    ctx: AppContext,
    resourceId: string,
    userId: string,
) => Promise<boolean>;

/**
 * Middleware to require resource ownership OR a single permission.
 * Sets `c.get('isResourceOwner')` to indicate if user is the owner.
 *
 * @example
 * app.delete('/events/:id',
 *     requireOwnershipOrPermission('id', isEventOwner, 'events:delete'),
 *     async (c) => {
 *         const isOwner = c.get('isResourceOwner');
 *         // Handle deletion...
 *     }
 * );
 */
export const requireOwnershipOrPermission = (
    resourceIdParam: string,
    ownershipChecker: ResourceOwnershipChecker,
    permissionName: string,
) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const resourceId = c.req.param(resourceIdParam);
        if (!resourceId) {
            throw new HTTPException(400, {
                message: "Resource ID required",
            });
        }

        // Check ownership first
        const isOwner = await ownershipChecker(
            c.get("ctx"),
            resourceId,
            user.id,
        );

        if (!isOwner) {
            // Not owner, check permission
            const hasPerm = await hasPermission(
                c.get("ctx"),
                user.id,
                permissionName,
            );
            if (!hasPerm) {
                throw new HTTPException(403, {
                    message:
                        "Forbidden - you must be the owner or have the required permission",
                });
            }
        }

        c.set("isResourceOwner", isOwner);
        await next();
    });

/**
 * Middleware to require resource ownership OR any of multiple permissions.
 * Sets `c.get('isResourceOwner')` to indicate if user is the owner.
 *
 * @example
 * app.put('/events/:id',
 *     requireOwnershipOrAnyPermission('id', isEventOwner, ['events:update', 'events:manage']),
 *     async (c) => {
 *         const isOwner = c.get('isResourceOwner');
 *         // Handle update...
 *     }
 * );
 */
export const requireOwnershipOrAnyPermission = (
    resourceIdParam: string,
    ownershipChecker: ResourceOwnershipChecker,
    permissionNames: string[],
) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const resourceId = c.req.param(resourceIdParam);
        if (!resourceId) {
            throw new HTTPException(400, {
                message: "Resource ID required",
            });
        }

        // Check ownership first
        const isOwner = await ownershipChecker(
            c.get("ctx"),
            resourceId,
            user.id,
        );

        if (!isOwner) {
            // Not owner, check any permission
            const hasPerm = await hasAnyPermission(
                c.get("ctx"),
                user.id,
                permissionNames,
            );
            if (!hasPerm) {
                throw new HTTPException(403, {
                    message:
                        "Forbidden - you must be the owner or have one of the required permissions",
                });
            }
        }

        c.set("isResourceOwner", isOwner);
        await next();
    });

/**
 * Middleware to require resource ownership OR a scoped permission.
 * Checks if user owns the resource OR has the permission (globally or scoped).
 * Sets `c.get('isResourceOwner')` to indicate if user is the owner.
 *
 * This is the key middleware for combining ownership + attribute-based access control.
 *
 * Flow:
 * 1. Check if user owns the resource → Allow
 * 2. Check if user has global permission → Allow
 * 3. Check if user has scoped permission for this resource → Allow
 * 4. Otherwise → Deny
 *
 * @param resourceIdParam - Route parameter name for resource ID
 * @param ownershipChecker - Function to check if user owns the resource
 * @param permissionName - Required permission name
 * @param scopeResolver - Function to extract scope from request (e.g., `c => `group:${c.req.param('slug')}`)
 *
 * @example
 * // User can update group if they are:
 * // 1. A group leader (owner), OR
 * // 2. Have global "groups:update" permission, OR
 * // 3. Have "groups:update" scoped to "group:fotball"
 * app.put('/groups/:slug',
 *     requireAuth,
 *     requireOwnershipOrScopedPermission(
 *         "slug",
 *         isGroupLeader,
 *         "groups:update",
 *         (c) => `group:${c.req.param('slug')}`
 *     ),
 *     async (c) => { ... }
 * );
 */
export const requireOwnershipOrScopedPermission = (
    resourceIdParam: string,
    ownershipChecker: ResourceOwnershipChecker,
    permissionName: string,
    scopeResolver: (c: any) => string,
) =>
    createMiddleware<{ Variables: Variables }>(async (c, next) => {
        const user = c.get("user");

        if (!user) {
            throw new HTTPException(401, {
                message: "Authentication required",
            });
        }

        const resourceId = c.req.param(resourceIdParam);
        if (!resourceId) {
            throw new HTTPException(400, {
                message: "Resource ID required",
            });
        }

        const ctx = c.get("ctx");

        // 1. Check ownership first (fastest check, no DB query for permissions)
        const isOwner = await ownershipChecker(ctx, resourceId, user.id);

        if (isOwner) {
            // Owner has full access, no permission check needed
            c.set("isResourceOwner", true);
            await next();
            return;
        }

        // 2. Not owner, check if they have the permission globally
        const hasGlobalPerm = await hasPermission(ctx, user.id, permissionName);

        if (hasGlobalPerm) {
            // Has global permission, allow access
            c.set("isResourceOwner", false);
            await next();
            return;
        }

        // 3. Not owner and no global permission, check scoped permission
        const scope = scopeResolver(c);
        const { hasScopedPermission } = await import(
            "~/lib/auth/rbac/roles"
        );
        const hasScopedPerm = await hasScopedPermission(
            ctx,
            user.id,
            permissionName,
            scope,
        );

        if (!hasScopedPerm) {
            throw new HTTPException(403, {
                message: `Forbidden - you must be the owner or have permission: ${permissionName} (globally or for ${scope})`,
            });
        }

        c.set("isResourceOwner", false);
        await next();
    });
