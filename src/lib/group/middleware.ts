/**
 * Group-specific resource ownership checkers.
 *
 * These functions are used with the centralized requireOwnershipOrPermission middleware
 * to check if a user has ownership or specific relationships with group resources.
 *
 * @example
 * app.put('/groups/:slug',
 *     requireAuth,
 *     requireScopedPermission("groups:update", (c) => `group:${c.req.param('slug')}`),
 *     requireOwnershipOrPermission("slug", isGroupLeader, "groups:manage"),
 *     async (c) => { ... }
 * );
 */

import { eq } from "drizzle-orm";
import { schema } from "~/db";
import type { OwnershipChecker } from "~/middleware/access";
import type { AppContext } from "../ctx";

/**
 * Check if a user is a group leader
 */
export const isGroupLeader: OwnershipChecker = async (
    ctx: AppContext,
    groupSlug: string,
    userId: string,
): Promise<boolean> => {
    const membership = await ctx.db.query.groupMembership.findFirst({
        where: (membership, { and, eq }) =>
            and(
                eq(membership.groupSlug, groupSlug),
                eq(membership.userId, userId),
                eq(membership.role, "leader"),
            ),
    });

    return !!membership;
};

/**
 * Check if a user is a group member (any role)
 */
export const isGroupMember = async (
    ctx: AppContext,
    groupSlug: string,
    userId: string,
): Promise<boolean> => {
    const membership = await ctx.db.query.groupMembership.findFirst({
        where: (membership, { and, eq }) =>
            and(
                eq(membership.groupSlug, groupSlug),
                eq(membership.userId, userId),
            ),
    });

    return !!membership;
};

/**
 * Check if a user is the fines admin for a group
 */
export const isFinesAdmin = async (
    ctx: AppContext,
    groupSlug: string,
    userId: string,
): Promise<boolean> => {
    const group = await ctx.db
        .select()
        .from(schema.group)
        .where(eq(schema.group.slug, groupSlug))
        .limit(1)
        .then((res) => res[0]);

    return group?.finesAdminId === userId;
};

/**
 * Check if a user created a specific fine
 */
export const isFineCreator: OwnershipChecker = async (
    ctx: AppContext,
    fineId: string,
    userId: string,
): Promise<boolean> => {
    // Validate UUID format
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fineId)) {
        return false;
    }

    const fine = await ctx.db
        .select()
        .from(schema.fine)
        .where(eq(schema.fine.id, fineId))
        .limit(1)
        .then((res) => res[0]);

    return fine?.createdByUserId === userId;
};

/**
 * Check if a user received a specific fine
 */
export const isFineRecipient = async (
    ctx: AppContext,
    fineId: string,
    userId: string,
): Promise<boolean> => {
    // Validate UUID format
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(fineId)) {
        return false;
    }

    const fine = await ctx.db
        .select()
        .from(schema.fine)
        .where(eq(schema.fine.id, fineId))
        .limit(1)
        .then((res) => res[0]);

    return fine?.userId === userId;
};
