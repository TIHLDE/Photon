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

import type { OwnershipChecker } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { isValidUUID } from "~/lib/validation/uuid";

/**
 * Check if a user is a group leader
 */
export const isGroupLeader: OwnershipChecker = async (
    ctx,
    groupSlug,
    userId,
) => {
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
export const isGroupMember: OwnershipChecker = async (
    ctx,
    groupSlug,
    userId,
) => {
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
export const isFinesAdmin: OwnershipChecker = async (
    ctx,
    groupSlug,
    userId,
) => {
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
export const isFineCreator: OwnershipChecker = async (ctx, fineId, userId) => {
    if (!isValidUUID(fineId)) {
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
export const isFineRecipient: OwnershipChecker = async (
    ctx,
    fineId,
    userId,
) => {
    if (!isValidUUID(fineId)) {
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
