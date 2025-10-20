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
