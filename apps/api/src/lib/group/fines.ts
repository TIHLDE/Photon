/**
 * Fines management utilities and permission checks.
 *
 * This module provides functions for:
 * - Checking fine permissions (who can create, approve, delete fines)
 * - Fine status transitions
 * - Fine validation
 */

import { hasPermission } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { canManageGroupResource, getGroup, isGroupLeader } from "./index";

/**
 * Get a fine by its ID.
 */
export async function getFine(ctx: AppContext, fineId: string) {
    const db = ctx.db;
    const [fine] = await db
        .select()
        .from(schema.fine)
        .where(eq(schema.fine.id, fineId))
        .limit(1);

    return fine ?? null;
}

/**
 * Check if a user can create fines for a group.
 * Respects the group's permission mode.
 *
 * Rules:
 * - Root or fines:manage bypasses all checks
 * - User must have fines:create permission
 * - Scope check: Must be member/leader based on group's permissionMode
 *
 * @param userId - User trying to create the fine
 * @param groupSlug - Group the fine belongs to
 */
export async function canCreateFine(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<boolean> {
    // Root or fines:manage bypass
    if (await hasPermission(ctx, userId, ["root", "fines:manage"])) {
        return true;
    }

    // Check group's fines are activated
    const group = await getGroup(ctx, groupSlug);
    if (!group?.finesActivated) {
        return false; // Fines not enabled for this group
    }

    // Use the group resource scoping function
    return await canManageGroupResource(ctx, userId, groupSlug, "fines:create");
}

/**
 * Check if a user can approve/reject a fine.
 *
 * Rules:
 * - Root or fines:manage bypasses all checks
 * - User must be the fines admin for the group, OR
 * - User must be a group leader with fines:update permission
 *
 * @param userId - User trying to approve/reject
 * @param fineId - Fine ID
 */
export async function canApproveFine(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    // Root or fines:manage bypass
    if (await hasPermission(ctx, userId, ["root", "fines:manage"])) {
        return true;
    }

    const fine = await getFine(ctx, fineId);
    if (!fine) {
        return false; // Fine doesn't exist
    }

    const group = await getGroup(ctx, fine.groupSlug);
    if (!group) {
        return false; // Group doesn't exist
    }

    // Check if user is the fines admin
    if (group.finesAdminId === userId) {
        return true;
    }

    // Check if user is a group leader with fines:update permission
    const [isLeader, hasUpdatePerm] = await Promise.all([
        isGroupLeader(ctx, userId, fine.groupSlug),
        hasPermission(ctx, userId, "fines:update"),
    ]);

    return isLeader && hasUpdatePerm;
}

/**
 * Check if a user can delete a fine.
 *
 * Rules:
 * - Root or fines:manage bypasses all checks
 * - User must be the fine creator (if fine is still pending), OR
 * - User must be the fines admin, OR
 * - User must be a group leader with fines:delete permission
 *
 * @param userId - User trying to delete
 * @param fineId - Fine ID
 */
export async function canDeleteFine(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    // Root or fines:manage bypass
    if (await hasPermission(ctx, userId, ["root", "fines:manage"])) {
        return true;
    }

    const fine = await getFine(ctx, fineId);
    if (!fine) {
        return false; // Fine doesn't exist
    }

    // Creators can delete their own pending fines
    if (fine.createdByUserId === userId && fine.status === "pending") {
        return true;
    }

    const group = await getGroup(ctx, fine.groupSlug);
    if (!group) {
        return false; // Group doesn't exist
    }

    // Fines admin can delete any fine
    if (group.finesAdminId === userId) {
        return true;
    }

    // Group leaders with fines:delete permission can delete
    const [isLeader, hasDeletePerm] = await Promise.all([
        isGroupLeader(ctx, userId, fine.groupSlug),
        hasPermission(ctx, userId, "fines:delete"),
    ]);

    return isLeader && hasDeletePerm;
}

/**
 * Check if a user can view a fine.
 *
 * Rules:
 * - Root or fines:view bypasses all checks
 * - User must be a member of the group the fine belongs to, OR
 * - User must be the fine recipient, OR
 * - User must be the fine creator
 *
 * @param userId - User trying to view
 * @param fineId - Fine ID
 */
export async function canViewFine(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    // Root or fines:view bypass
    if (await hasPermission(ctx, userId, ["root", "fines:view"])) {
        return true;
    }

    const fine = await getFine(ctx, fineId);
    if (!fine) {
        return false; // Fine doesn't exist
    }

    // Fine recipient can view their own fine
    if (fine.userId === userId) {
        return true;
    }

    // Fine creator can view the fine they created
    if (fine.createdByUserId === userId) {
        return true;
    }

    // Group members with fines:view permission can view
    const [membership, hasViewPerm] = await Promise.all([
        ctx.db.query.groupMembership.findFirst({
            where: (gm, { and, eq }) =>
                and(eq(gm.userId, userId), eq(gm.groupSlug, fine.groupSlug)),
        }),
        hasPermission(ctx, userId, "fines:view"),
    ]);

    return !!membership && hasViewPerm;
}

/**
 * Check if a user can add a defense to a fine.
 *
 * Rules:
 * - Only the fine recipient can add a defense
 * - Fine must be in "pending" or "approved" status
 *
 * @param userId - User trying to add defense
 * @param fineId - Fine ID
 */
export async function canAddFineDefense(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    const fine = await getFine(ctx, fineId);
    if (!fine) {
        return false; // Fine doesn't exist
    }

    // Only the fine recipient can add a defense
    if (fine.userId !== userId) {
        return false;
    }

    // Can only defend pending or approved fines (not paid or rejected)
    return fine.status === "pending" || fine.status === "approved";
}

/**
 * Check if a user can mark a fine as paid.
 *
 * Rules:
 * - Root or fines:manage bypasses all checks
 * - User must be the fines admin for the group, OR
 * - User must be a group leader with fines:update permission
 *
 * @param userId - User trying to mark as paid
 * @param fineId - Fine ID
 */
export async function canMarkFinePaid(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    // Same permissions as approving a fine
    return await canApproveFine(ctx, userId, fineId);
}

/**
 * Get all fines for a user across all groups.
 */
export async function getUserFines(ctx: AppContext, userId: string) {
    const db = ctx.db;
    return await db
        .select()
        .from(schema.fine)
        .where(eq(schema.fine.userId, userId));
}

/**
 * Get all fines for a group.
 * Requires fines:view permission and group membership.
 */
export async function getGroupFines(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
) {
    // Check if user can view fines for this group
    const [membership, hasViewPerm] = await Promise.all([
        ctx.db.query.groupMembership.findFirst({
            where: (gm, { and, eq }) =>
                and(eq(gm.userId, userId), eq(gm.groupSlug, groupSlug)),
        }),
        hasPermission(ctx, userId, "fines:view"),
    ]);

    if (!membership && !(await hasPermission(ctx, userId, ["root"]))) {
        throw new Error("Not a member of this group");
    }

    if (!hasViewPerm && !(await hasPermission(ctx, userId, ["root"]))) {
        throw new Error("Missing permission: fines:view");
    }

    const db = ctx.db;
    return await db
        .select()
        .from(schema.fine)
        .where(eq(schema.fine.groupSlug, groupSlug));
}
