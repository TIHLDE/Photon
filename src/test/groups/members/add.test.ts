import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("add group member", () => {
	integrationTest(
		"successfully adds a member to a group with groups:manage permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const group = await ctx.utils.createTestGroup({ slug: "test-group" });

			// Create another user to add as member
			const memberUser = await ctx.auth.api.createUser({
				body: {
					email: "member@test.com",
					name: "Member User",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: memberUser.user.id,
					role: "member",
				},
			});

			expect(response.status).toBe(201);

			const json = await response.json();
			expect(json.userId).toBe(memberUser.user.id);
			expect(json.groupSlug).toBe(group.slug);
			expect(json.role).toBe("member");
		},
		500_000,
	);

	integrationTest(
		"successfully adds a leader to a group",
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

			const response = await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: leaderUser.user.id,
					role: "leader",
				},
			});

			expect(response.status).toBe(201);

			const json = await response.json();
			expect(json.role).toBe("leader");
		},
		500_000,
	);

	integrationTest(
		"fails to add member without groups:manage permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup();

			const memberUser = await ctx.auth.api.createUser({
				body: {
					email: "noperm@test.com",
					name: "No Permission",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: memberUser.user.id,
					role: "member",
				},
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 when adding member to non-existent group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const memberUser = await ctx.auth.api.createUser({
				body: {
					email: "member@test.com",
					name: "Member User",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: "non-existent-group" },
				json: {
					userId: memberUser.user.id,
					role: "member",
				},
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);

	integrationTest(
		"fails to add non-existent user as member",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const group = await ctx.utils.createTestGroup();

			const response = await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: "non-existent-user",
					role: "member",
				},
			});

			expect(response.status).toBe(400);
		},
		500_000,
	);

	integrationTest(
		"fails to add user who is already a member",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

			const group = await ctx.utils.createTestGroup();

			const memberUser = await ctx.auth.api.createUser({
				body: {
					email: "duplicate@test.com",
					name: "Duplicate Member",
					password: "test123!",
				},
			});

			// Add member first time
			await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: memberUser.user.id,
					role: "member",
				},
			});

			// Try to add again
			const response = await client.api.groups[":groupSlug"].members.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: memberUser.user.id,
					role: "member",
				},
			});

			expect(response.status).toBe(400);
		},
		500_000,
	);
});
