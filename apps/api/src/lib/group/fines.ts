/**
 * Fines management utilities and access checks.
 *
 * Bøter are deliberately NOT part of the permission system. Giving and reading
 * bøter is what being in a group is: you see what the group has handed out to
 * each other, and you can hand one out yourself. Expressing that as a
 * `fines:*` checkbox per group meant every group had to be configured to get
 * its own baseline behaviour, and the permission was global anyway — so a
 * group-scoped grant was silently rejected while a global one opened every
 * group's bøter at once.
 *
 * So the rules are membership, not permissions:
 * - Member of the group    → view every fine in it, and create fines in it
 * - Fines admin, or leader → approve, reject, mark paid, delete
 * - root                   → everything, across all groups
 *
 * The recipient of a fine always sees it and may defend it, member or not
 * (memberships end; the fine outlives them).
 */

import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { getGroup, isGroupLeader, isGroupMember } from "./index";

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
 * Root sees and edits every fine in every group. This is the only cross-group
 * access there is — held by the Teknologiminister title.
 */
async function isFinesRoot(ctx: AppContext, userId: string): Promise<boolean> {
    return await hasPermission(ctx, userId, "root");
}

/**
 * Can the user create fines for a group?
 *
 * Any member of the group can, provided the group has bøter switched on.
 */
export async function canCreateFine(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<boolean> {
    if (await isFinesRoot(ctx, userId)) {
        return true;
    }

    const group = await getGroup(ctx, groupSlug);
    if (!group?.finesActivated) {
        return false; // Fines not enabled for this group
    }

    return await isGroupMember(ctx, userId, groupSlug);
}

/**
 * Can the user approve/reject a fine?
 *
 * Handing out a fine is something any member does; ruling on it is not. That
 * stays with the group's fines admin and its leader.
 */
export async function canApproveFine(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    if (await isFinesRoot(ctx, userId)) {
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

    if (group.finesAdminId === userId) {
        return true;
    }

    return await isGroupLeader(ctx, userId, fine.groupSlug);
}

/**
 * Can the user delete a fine?
 *
 * The author may withdraw their own fine while it is still pending; otherwise
 * it takes the fines admin or the leader.
 */
export async function canDeleteFine(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    if (await isFinesRoot(ctx, userId)) {
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

    if (group.finesAdminId === userId) {
        return true;
    }

    return await isGroupLeader(ctx, userId, fine.groupSlug);
}

/**
 * Can the user view a fine?
 *
 * Everyone in the group sees everything the group has handed out. The
 * recipient and the author see it regardless — a fine outlives the membership
 * that produced it.
 */
export async function canViewFine(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
    if (await isFinesRoot(ctx, userId)) {
        return true;
    }

    const fine = await getFine(ctx, fineId);
    if (!fine) {
        return false; // Fine doesn't exist
    }

    if (fine.userId === userId || fine.createdByUserId === userId) {
        return true;
    }

    return await isGroupMember(ctx, userId, fine.groupSlug);
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
 * Same rules as approving — the fines admin or the group's leader.
 */
export async function canMarkFinePaid(
    ctx: AppContext,
    userId: string,
    fineId: string,
): Promise<boolean> {
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
 * Get all fines for a group. Requires membership, or root.
 */
export async function getGroupFines(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
) {
    const [isMember, isRoot] = await Promise.all([
        isGroupMember(ctx, userId, groupSlug),
        isFinesRoot(ctx, userId),
    ]);

    if (!isMember && !isRoot) {
        throw new Error("Not a member of this group");
    }

    const db = ctx.db;
    return await db
        .select()
        .from(schema.fine)
        .where(eq(schema.fine.groupSlug, groupSlug));
}
