/**
 * Group management utilities and resource scoping helpers.
 *
 * This module provides functions for:
 * - Checking group membership and leadership
 * - Managing group-scoped permissions
 * - Keeping HS in sync with subgroup leadership
 */

import { hasPermission, hasScopedPermission } from "@photon/auth/rbac";
import { type DbSchema, schema } from "@photon/db";
import { type InferSelectModel, and, eq, inArray, ne } from "drizzle-orm";
import type { AppContext } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";

/**
 * Group types whose membership is a projection of Feide, not an editable list.
 *
 * `syncDerivedStudyGroups` rebuilds these on every Feide login from the user's
 * study programme, so an edit made here would either be silently reinstated or
 * quietly contradict what NTNU reports. Refusing the write says so out loud
 * instead of letting the two drift apart.
 *
 * Compared case-insensitively: the column is a varchar rather than the
 * `groupType` enum, and the rows migrated from Lepton are upper case.
 */
const DERIVED_GROUP_TYPES = new Set(["study", "studyyear"]);

/** True when membership of this group is derived and must not be hand-edited. */
export function isDerivedGroupType(type: string): boolean {
    return DERIVED_GROUP_TYPES.has(type.toLowerCase());
}

/**
 * Group types whose page is for members only.
 *
 * A `PRIVATE` group is not a group the organisation presents outwards — the
 * digital transformasjon-faddergruppa is the standing example. Its name still
 * shows up wherever memberships are listed (a profile says which groups the
 * person is in), but the page itself, the roster and the verv are the members'
 * own. Everything that reads them therefore goes through
 * {@link assertGroupVisible}.
 *
 * Compared case-insensitively: the column is a varchar rather than the
 * `groupType` enum, and the rows migrated from Lepton are upper case.
 */
const PRIVATE_GROUP_TYPES = new Set(["private"]);

/** True when only the group's own members may open it. */
export function isPrivateGroupType(type: string): boolean {
    return PRIVATE_GROUP_TYPES.has(type.toLowerCase());
}

/**
 * Whether `userId` may read a private group's page, roster and verv.
 *
 * Members always may. `groups:manage` — globally or scoped to this group — is
 * the only way in from the outside, and it exists so the admin panel keeps
 * working; no ordinary member, and nobody signed out, gets past this.
 */
export async function canViewGroup(
    ctx: AppContext,
    group: { slug: string; type: string },
    userId: string | null | undefined,
): Promise<boolean> {
    if (!isPrivateGroupType(group.type)) return true;
    if (!userId) return false;
    if (await isGroupMember(ctx, userId, group.slug)) return true;

    return hasScopedPermission(
        ctx,
        userId,
        "groups:manage",
        `group:${group.slug}`,
    );
}

/** {@link canViewGroup}, as a guard: throws 403 instead of returning false. */
export async function assertGroupVisible(
    ctx: AppContext,
    group: { slug: string; type: string },
    userId: string | null | undefined,
): Promise<void> {
    if (await canViewGroup(ctx, group, userId)) return;

    throw HTTPAppException.Forbidden(
        "Denne gruppen er privat — bare medlemmene har tilgang.",
    );
}

/**
 * Get group membership for a user, including their role (member/leader).
 * Returns null if user is not a member.
 */
export async function getGroupMembership(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
) {
    const db = ctx.db;
    const [membership] = await db
        .select()
        .from(schema.groupMembership)
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, groupSlug),
            ),
        )
        .limit(1);

    return membership ?? null;
}

/**
 * Check if a user is a member of a group (any role: member or leader).
 */
export async function isGroupMember(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<boolean> {
    const membership = await getGroupMembership(ctx, userId, groupSlug);
    return membership !== null;
}

/**
 * Check if a user is a leader of a group.
 */
export async function isGroupLeader(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<boolean> {
    const membership = await getGroupMembership(ctx, userId, groupSlug);
    return membership?.role === "leader";
}

/**
 * Get a group by its slug.
 */
export async function getGroup(ctx: AppContext, groupSlug: string) {
    const db = ctx.db;
    const [group] = await db
        .select()
        .from(schema.group)
        .where(eq(schema.group.slug, groupSlug))
        .limit(1);

    return group ?? null;
}

/**
 * Add a user to a group with the specified role.
 * If the group has an associated RBAC role, auto-assigns it to the user.
 *
 * @param userId - User to add to the group
 * @param groupSlug - Group slug
 * @param role - Group role (member or leader), defaults to "member"
 * @returns The membership, whether newly created or already present
 */
export async function addUserToGroup(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
    role: "member" | "leader" = "member",
): Promise<InferSelectModel<DbSchema["groupMembership"]>> {
    const db = ctx.db;

    // Get the group to check if it has an associated role
    const group = await getGroup(ctx, groupSlug);
    if (!group) {
        throw new Error(`Group not found: ${groupSlug}`);
    }

    // Add user to group
    const [inserted] = await db
        .insert(schema.groupMembership)
        .values({
            userId,
            groupSlug,
            role,
        })
        .onConflictDoNothing()
        .returning();

    // onConflictDoNothing returns nothing when the membership already exists,
    // so fall back to reading it — callers still need a membership back.
    const membership =
        inserted ??
        (await db.query.groupMembership.findFirst({
            where: and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, groupSlug),
            ),
        }));

    if (!membership) {
        throw new Error(`Failed to add user ${userId} to group ${groupSlug}`);
    }

    // No role juggling here any more: what members of this group may do lives
    // in group.memberPermissions / memberGlobalPermissions and is read live
    // from the membership itself (getPermissionsFromMembership), so joining
    // grants it and leaving revokes it with nothing to sync.

    // Subgroup leaders sit in HS
    if (membership.role === "leader") {
        await demoteOtherLeaders(ctx, groupSlug, userId);
        await syncSubgroupLeaderIntoHs(ctx, userId, group);
    }

    return membership;
}

/**
 * En gruppe har én leder. Sett alle andre ledere ned til vanlig medlem når
 * `newLeaderId` tar over.
 *
 * Uten dette blir den forrige lederen liggende igjen med `role = "leader"`, og
 * gruppesiden viser bare den første av dem: den andre forsvinner fra både
 * medlemslista og «tidligere medlemmer», mens profilen hans fortsatt sier
 * «Leder». Da finnes det heller ingen knapp igjen for å fjerne ham.
 */
export async function demoteOtherLeaders(
    ctx: AppContext,
    groupSlug: string,
    newLeaderId: string,
): Promise<void> {
    const outgoing = await ctx.db
        .update(schema.groupMembership)
        .set({ role: "member", updatedAt: new Date() })
        .where(
            and(
                eq(schema.groupMembership.groupSlug, groupSlug),
                eq(schema.groupMembership.role, "leader"),
                ne(schema.groupMembership.userId, newLeaderId),
            ),
        )
        .returning({ userId: schema.groupMembership.userId });

    if (outgoing.length === 0) return;

    const group = await getGroup(ctx, groupSlug);
    if (!group) return;

    // Avgåtte undergruppeledere mister HS-plassen på samme måte som når de
    // settes ned manuelt eller meldes ut.
    if (isSubgroupType(group.type)) {
        for (const { userId } of outgoing) {
            await syncSubgroupLeaderOutOfHs(ctx, userId, groupSlug);
        }
        return;
    }

    // HS er AU + undergruppelederne, ikke et sted man blir sittende: en
    // avgått president har ingenting der å gjøre med mindre noe annet gir
    // plassen (et AU-verv eller lederskapet i en undergruppe), akkurat som
    // for undergruppelederne over.
    if (group.slug === HS_GROUP_SLUG) {
        for (const { userId } of outgoing) {
            await pruneHsMembershipIfUnwarranted(ctx, userId);
        }
    }
}

/**
 * Remove a user from a group.
 * If the group has an associated RBAC role, auto-removes it from the user.
 *
 * @param userId - User to remove from the group
 * @param groupSlug - Group slug
 */
export async function removeUserFromGroup(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<void> {
    const db = ctx.db;

    // Get the group to check if it has an associated role
    const group = await getGroup(ctx, groupSlug);
    if (!group) {
        throw new Error(`Group not found: ${groupSlug}`);
    }

    // Was this the subgroup's leader? (checked before the row is deleted)
    const wasSubgroupLeader =
        isSubgroupType(group.type) &&
        (await isGroupLeader(ctx, userId, groupSlug));

    // Remove user from group
    const [removed] = await db
        .delete(schema.groupMembership)
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, groupSlug),
            ),
        )
        .returning();

    // Keep the stint in the group's history ("tidligere medlemmer"). Nothing
    // is written when there was no membership to delete, so calling this for
    // a non-member stays a no-op. A repeated removal within the same
    // millisecond would collide on the stint index — ignore it rather than
    // fail the request, since the period is already recorded.
    if (removed) {
        await db
            .insert(schema.groupMembershipHistory)
            .values({
                userId,
                groupSlug,
                role: removed.role,
                startedAt: removed.createdAt,
                // endedAt is left to the database clock — see the column.
            })
            .onConflictDoNothing();
    }

    // Leaving the group forfeits any positions held in it. The group's own
    // permissions need no cleanup — they hang off the membership row that was
    // just deleted.
    await removeUserPositionsInGroup(ctx, userId, groupSlug);

    // A departing subgroup leader forfeits the HS seat too (unless something
    // else warrants it — see pruneHsMembershipIfUnwarranted)
    if (wasSubgroupLeader) {
        await syncSubgroupLeaderOutOfHs(ctx, userId, groupSlug);
    }
}

/**
 * Remove all positions (verv) a user holds in a group.
 * Called when a user leaves the group — positions require membership.
 */
export async function removeUserPositionsInGroup(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<void> {
    const db = ctx.db;
    await db
        .delete(schema.groupPositionHolder)
        .where(
            and(
                eq(schema.groupPositionHolder.userId, userId),
                inArray(
                    schema.groupPositionHolder.positionId,
                    db
                        .select({ id: schema.groupPosition.id })
                        .from(schema.groupPosition)
                        .where(eq(schema.groupPosition.groupSlug, groupSlug)),
                ),
            ),
        );
}

/**
 * Update a user's role in a group (member <-> leader).
 *
 * @param userId - User whose role to update
 * @param groupSlug - Group slug
 * @param newRole - New role (member or leader)
 */
export async function updateGroupMemberRole(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
    newRole: "member" | "leader",
): Promise<void> {
    const db = ctx.db;

    await db
        .update(schema.groupMembership)
        .set({ role: newRole, updatedAt: new Date() })
        .where(
            and(
                eq(schema.groupMembership.userId, userId),
                eq(schema.groupMembership.groupSlug, groupSlug),
            ),
        );

    // Lederbyttet setter den forrige lederen ned — gruppa har én leder.
    if (newRole === "leader") {
        await demoteOtherLeaders(ctx, groupSlug, userId);
    }

    const group = await getGroup(ctx, groupSlug);

    // Keep HS in sync with subgroup leadership
    if (group && isSubgroupType(group.type)) {
        if (newRole === "leader") {
            await syncSubgroupLeaderIntoHs(ctx, userId, group);
        } else {
            await syncSubgroupLeaderOutOfHs(ctx, userId, groupSlug);
        }
    }
}

// =============================================================================
// HS auto-membership for subgroup leaders
//
// Hovedstyret = AU + the leaders of every subgroup. When someone becomes
// leader of a group of type "subgroup", they are automatically added to the
// hs group and assigned the subgroup's linked leader-verv (created on the
// fly as "Leder av <gruppe>" if none is linked yet — minister titles like
// Teknologiminister are linked via groupPosition.linkedGroupSlug and are
// then reused instead). When they lose the leadership, the verv is taken
// back and the hs membership is removed unless something else warrants it
// (another subgroup leadership or another hs verv, e.g. an AU title).
// =============================================================================

export const HS_GROUP_SLUG = "hs";

/** True for groups whose leader belongs in HS. Column is freeform varchar
 *  (Lepton rows are upper case), so compare case-insensitively. */
export function isSubgroupType(type: string): boolean {
    return type.toLowerCase() === "subgroup";
}

/**
 * True for groups whose next leader may be someone who is not a member yet.
 *
 * HS is the exception: presidenten velges på generalforsamlingen og sitter
 * ikke i Hovedstyret før hun tar over, så lederen kan ikke plukkes blant HS
 * sine egne medlemmer. Alle andre grupper velger lederen sin innenfra, og der
 * er «ikke medlem» en feil verdt å stoppe på.
 */
export function allowsNonMemberLeader(group: { slug: string }): boolean {
    return group.slug === HS_GROUP_SLUG;
}

/**
 * Get the leader-verv linked to a subgroup (in any group, normally hs).
 */
async function getLinkedLeaderPosition(ctx: AppContext, groupSlug: string) {
    const [position] = await ctx.db
        .select()
        .from(schema.groupPosition)
        .where(eq(schema.groupPosition.linkedGroupSlug, groupSlug))
        .limit(1);
    return position ?? null;
}

/**
 * Called when `userId` BECOMES leader of `group`. No-op unless the group is
 * a subgroup and the hs group exists. Adds the leader to hs and hands them
 * the linked leader-verv (replacing any previous holder — a verv has exactly
 * one holder, and leadership is the source of truth for this one).
 */
export async function syncSubgroupLeaderIntoHs(
    ctx: AppContext,
    userId: string,
    group: InferSelectModel<DbSchema["group"]>,
): Promise<void> {
    if (!isSubgroupType(group.type) || group.slug === HS_GROUP_SLUG) return;
    const hsGroup = await getGroup(ctx, HS_GROUP_SLUG);
    if (!hsGroup) return; // e.g. minimal test fixtures without an hs group

    await addUserToGroup(ctx, userId, HS_GROUP_SLUG, "member");

    let position = await getLinkedLeaderPosition(ctx, group.slug);
    if (!position) {
        const [created] = await ctx.db
            .insert(schema.groupPosition)
            .values({
                groupSlug: HS_GROUP_SLUG,
                name: `Leder av ${group.name}`,
                description: `Leder av ${group.name} — automatisk verv, følger ledervervet i gruppen`,
                permissions: [],
                scope: "global",
                linkedGroupSlug: group.slug,
            })
            .returning();
        position = created ?? null;
    }
    if (!position) return;

    // Hand the verv to the new leader (single holder — replace).
    await ctx.db
        .delete(schema.groupPositionHolder)
        .where(eq(schema.groupPositionHolder.positionId, position.id));
    await ctx.db.insert(schema.groupPositionHolder).values({
        positionId: position.id,
        userId,
    });
}

/**
 * Called when `userId` STOPS being leader of subgroup `groupSlug`. Takes the
 * linked leader-verv back (if they hold it) and prunes the hs membership if
 * nothing else warrants it.
 */
async function syncSubgroupLeaderOutOfHs(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<void> {
    const position = await getLinkedLeaderPosition(ctx, groupSlug);
    if (position) {
        await ctx.db
            .delete(schema.groupPositionHolder)
            .where(
                and(
                    eq(schema.groupPositionHolder.positionId, position.id),
                    eq(schema.groupPositionHolder.userId, userId),
                ),
            );
    }
    await pruneHsMembershipIfUnwarranted(ctx, userId);
}

/**
 * Remove `userId` from hs unless they still belong there: they lead hs
 * itself, they lead another subgroup, or they hold some hs verv (e.g. an AU
 * title). Safe to call for users who are not hs members at all.
 */
export async function pruneHsMembershipIfUnwarranted(
    ctx: AppContext,
    userId: string,
): Promise<void> {
    if (!(await isGroupMember(ctx, userId, HS_GROUP_SLUG))) return;

    // Still leader of hs itself, or of some subgroup?
    const memberships = await ctx.db
        .select({
            slug: schema.groupMembership.groupSlug,
            role: schema.groupMembership.role,
            type: schema.group.type,
        })
        .from(schema.groupMembership)
        .innerJoin(
            schema.group,
            eq(schema.groupMembership.groupSlug, schema.group.slug),
        )
        .where(eq(schema.groupMembership.userId, userId));
    if (
        memberships.some(
            (m) =>
                m.role === "leader" &&
                (m.slug === HS_GROUP_SLUG || isSubgroupType(m.type)),
        )
    )
        return;

    // Still holds an hs verv (e.g. AU title)?
    const [heldHsPosition] = await ctx.db
        .select({ positionId: schema.groupPositionHolder.positionId })
        .from(schema.groupPositionHolder)
        .innerJoin(
            schema.groupPosition,
            eq(schema.groupPositionHolder.positionId, schema.groupPosition.id),
        )
        .where(
            and(
                eq(schema.groupPositionHolder.userId, userId),
                eq(schema.groupPosition.groupSlug, HS_GROUP_SLUG),
            ),
        )
        .limit(1);
    if (heldHsPosition) return;

    await removeUserFromGroup(ctx, userId, HS_GROUP_SLUG);
}

/**
 * Check if a user can manage a specific group (update settings, etc.).
 * This checks if the user is a leader or has groups:manage permission.
 *
 * @param userId - User to check
 * @param groupSlug - Group slug
 * @returns true if user can manage the group itself
 */
export async function canManageGroup(
    ctx: AppContext,
    userId: string,
    groupSlug: string,
): Promise<boolean> {
    // Root or groups:manage bypass
    if (await hasPermission(ctx, userId, ["root", "groups:manage"])) {
        return true;
    }

    // Must be a leader and have groups:update permission
    const [isLeader, hasUpdatePerm] = await Promise.all([
        isGroupLeader(ctx, userId, groupSlug),
        hasPermission(ctx, userId, "groups:update"),
    ]);

    return isLeader && hasUpdatePerm;
}

/**
 * Get all groups a user is a member of.
 */
export async function getUserGroups(
    ctx: AppContext,
    userId: string,
): Promise<Array<{ slug: string; role: "member" | "leader" }>> {
    const db = ctx.db;
    const memberships = await db
        .select({
            slug: schema.groupMembership.groupSlug,
            role: schema.groupMembership.role,
        })
        .from(schema.groupMembership)
        .where(eq(schema.groupMembership.userId, userId));

    return memberships;
}

/**
 * Get all members of a group with their roles.
 */
export async function getGroupMembers(
    ctx: AppContext,
    groupSlug: string,
): Promise<
    Array<{
        userId: string;
        role: "member" | "leader";
        createdAt: Date;
        updatedAt: Date;
    }>
> {
    const db = ctx.db;
    const members = await db
        .select()
        .from(schema.groupMembership)
        .where(eq(schema.groupMembership.groupSlug, groupSlug));

    return members;
}
