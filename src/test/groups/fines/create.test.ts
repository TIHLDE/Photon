import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("create fine", () => {
	integrationTest(
		"successfully creates a fine as group leader",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup({
				slug: "fines-group",
				finesActivated: true,
			});

			// Make user a group leader
			await ctx.db.insert(schema.groupMembership).values({
				userId: user.id,
				groupSlug: group.slug,
				role: "leader",
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "target@test.com",
					name: "Target User",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "Late to meeting",
					amount: 50,
				},
			});

			expect(response.status).toBe(201);

			const json = await response.json();
			expect(json.userId).toBe(targetUser.user.id);
			expect(json.groupSlug).toBe(group.slug);
			expect(json.reason).toBe("Late to meeting");
			expect(json.amount).toBe(50);
			expect(json.status).toBe("pending");
		},
		500_000,
	);

	integrationTest(
		"successfully creates a fine with global fines:create permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:create"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "target2@test.com",
					name: "Target User 2",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "Violation of rules",
					amount: 100,
				},
			});

			expect(response.status).toBe(201);
		},
		500_000,
	);

	integrationTest(
		"fails to create fine when fines not activated for group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:create"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: false, // Fines not activated
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "target3@test.com",
					name: "Target User 3",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "Should fail",
					amount: 50,
				},
			});

			expect(response.status).toBe(400);
		},
		500_000,
	);

	integrationTest(
		"fails to create fine without permission and not being group leader",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "target4@test.com",
					name: "Target User 4",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "Should fail",
					amount: 50,
				},
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"fails to create fine for non-existent group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:create"]);

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "target5@test.com",
					name: "Target User 5",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: "non-existent" },
				json: {
					userId: targetUser.user.id,
					groupSlug: "non-existent",
					reason: "Should fail",
					amount: 50,
				},
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);

	integrationTest(
		"fails to create fine for non-existent user",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:create"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: "non-existent-user",
					groupSlug: group.slug,
					reason: "Should fail",
					amount: 50,
				},
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);

	integrationTest(
		"successfully creates fine with defense text",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:create"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "defense@test.com",
					name: "Defense User",
					password: "test123!",
				},
			});

			const response = await client.api.groups[":groupSlug"].fines.$post({
				param: { groupSlug: group.slug },
				json: {
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "Late arrival",
					amount: 25,
					defense: "Traffic was terrible",
				},
			});

			expect(response.status).toBe(201);

			const json = await response.json();
			expect(json.defense).toBe("Traffic was terrible");
		},
		500_000,
	);
});
