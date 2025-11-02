/**
 * Group management utilities and resource scoping helpers.
 *
 * This module provides functions for:
 * - Checking group membership and leadership
 * - Managing group-scoped permissions
 * - Auto-assigning roles when users join/leave groups
 * - Checking if users can manage group resources
 */

import { and, eq } from "drizzle-orm";
import { schema } from "~/db";
import type { AppContext } from "~/lib/ctx";
import {
	assignUserRole,
	getRoleById,
	removeUserRole,
} from "~/lib/auth/rbac/roles";
import { hasAnyPermission, hasPermission } from "~/lib/auth/rbac/permissions";

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
 */
export async function addUserToGroup(
	ctx: AppContext,
	userId: string,
	groupSlug: string,
	role: "member" | "leader" = "member",
): Promise<void> {
	const db = ctx.db;

	// Get the group to check if it has an associated role
	const group = await getGroup(ctx, groupSlug);
	if (!group) {
		throw new Error(`Group not found: ${groupSlug}`);
	}

	// Add user to group
	await db
		.insert(schema.groupMembership)
		.values({
			userId,
			groupSlug,
			role,
		})
		.onConflictDoNothing();

	// If group has an associated role, auto-assign it
	if (group.roleId) {
		const rbacRole = await getRoleById(ctx, group.roleId);
		if (rbacRole) {
			await assignUserRole(ctx, userId, rbacRole.name);
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

	// Remove user from group
	await db
		.delete(schema.groupMembership)
		.where(
			and(
				eq(schema.groupMembership.userId, userId),
				eq(schema.groupMembership.groupSlug, groupSlug),
			),
		);

	// If group has an associated role, auto-remove it
	if (group.roleId) {
		const rbacRole = await getRoleById(ctx, group.roleId);
		if (rbacRole) {
			await removeUserRole(ctx, userId, rbacRole.name);
		}
	}
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
		.set({ role: newRole })
		.where(
			and(
				eq(schema.groupMembership.userId, userId),
				eq(schema.groupMembership.groupSlug, groupSlug),
			),
		);
}

/**
 * Check if a user can manage resources for a group.
 * This is the core scoping function that respects the group's permissionMode.
 *
 * Permission modes:
 * - leader_only: Only group leaders can manage (default, more restrictive)
 * - member: Any member with the base permission can manage (more permissive)
 * - custom: Future - per-resource configuration
 *
 * @param userId - User to check
 * @param groupSlug - Group that owns the resource
 * @param permission - Required permission (e.g., "events:update")
 * @returns true if user can manage resources for this group
 *
 * @example
 * // Check if user can create events for football group
 * if (await canManageGroupResource(ctx, userId, "fotball", "events:create")) {
 *     // Allow event creation
 * }
 */
export async function canManageGroupResource(
	ctx: AppContext,
	userId: string,
	groupSlug: string,
	permission: string,
): Promise<boolean> {
	// 1. Check if user has root or management bypass permissions
	if (await hasAnyPermission(ctx, userId, ["root", "groups:manage"])) {
		return true;
	}

	// 2. Get the group to check permission mode
	const group = await getGroup(ctx, groupSlug);
	if (!group) {
		return false; // Group doesn't exist
	}

	// 3. Check base permission first
	if (!(await hasPermission(ctx, userId, permission))) {
		return false; // User doesn't have the required permission
	}

	// 4. Apply scoping based on group's permission mode
	switch (group.permissionMode) {
		case "leader_only": {
			// Only leaders can manage
			return await isGroupLeader(ctx, userId, groupSlug);
		}

		case "member": {
			// Any member with the permission can manage
			return await isGroupMember(ctx, userId, groupSlug);
		}

		case "custom": {
			// Future: Per-resource custom configuration
			// For now, default to leader_only
			return await isGroupLeader(ctx, userId, groupSlug);
		}

		default: {
			// Unknown mode, default to restrictive (leader_only)
			return await isGroupLeader(ctx, userId, groupSlug);
		}
	}
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
	if (await hasAnyPermission(ctx, userId, ["root", "groups:manage"])) {
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
