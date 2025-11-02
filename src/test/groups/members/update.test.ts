import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("update group member", () => {
	integrationTest(
		"successfully updates member role from member to leader",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const group = await ctx.utils.createTestGroup();

			const memberUser = await ctx.auth.api.createUser({
				body: {
					email: "member@test.com",
					name: "Member User",
					password: "test123!",
				},
			});

			// Add as member
			await ctx.db.insert(schema.groupMembership).values({
				userId: memberUser.user.id,
				groupSlug: group.slug,
				role: "member",
			});

			// Update to leader
			const response = await client.api.groups[":groupSlug"].members[
				":userId"
			].$patch({
				param: { groupSlug: group.slug, userId: memberUser.user.id },
				json: {
					role: "leader",
				},
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(json.message).toBe("Member role updated successfully");
		},
		500_000,
	);

	integrationTest(
		"successfully updates member role from leader to member",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const group = await ctx.utils.createTestGroup();

			const leaderUser = await ctx.auth.api.createUser({
				body: {
					email: "leader@test.com",
					name: "Leader User",
					password: "test123!",
				},
			});

			// Add as leader
			await ctx.db.insert(schema.groupMembership).values({
				userId: leaderUser.user.id,
				groupSlug: group.slug,
				role: "leader",
			});

			// Update to member
			const response = await client.api.groups[":groupSlug"].members[
				":userId"
			].$patch({
				param: { groupSlug: group.slug, userId: leaderUser.user.id },
				json: {
					role: "member",
				},
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(json.message).toBe("Member role updated successfully");
		},
		500_000,
	);

	integrationTest(
		"fails to update member without groups:manage permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup();

			const memberUser = await ctx.auth.api.createUser({
				body: {
					email: "member@test.com",
					name: "Member User",
					password: "test123!",
				},
			});

			await ctx.db.insert(schema.groupMembership).values({
				userId: memberUser.user.id,
				groupSlug: group.slug,
				role: "member",
			});

			const response = await client.api.groups[":groupSlug"].members[
				":userId"
			].$patch({
				param: { groupSlug: group.slug, userId: memberUser.user.id },
				json: {
					role: "leader",
				},
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 when updating non-existent membership",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const group = await ctx.utils.createTestGroup();

			const response = await client.api.groups[":groupSlug"].members[
				":userId"
			].$patch({
				param: { groupSlug: group.slug, userId: "non-existent-user" },
				json: {
					role: "leader",
				},
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);
});
