import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("list fines", () => {
	integrationTest(
		"successfully lists all fines for a group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:view"]);

			const group = await ctx.utils.createTestGroup({
				slug: "fines-list-group",
				finesActivated: true,
			});

			const targetUser1 = await ctx.auth.api.createUser({
				body: {
					email: "user1@test.com",
					name: "User 1",
					password: "test123!",
				},
			});

			const targetUser2 = await ctx.auth.api.createUser({
				body: {
					email: "user2@test.com",
					name: "User 2",
					password: "test123!",
				},
			});

			// Create some fines
			await ctx.db.insert(schema.fine).values([
				{
					userId: targetUser1.user.id,
					groupSlug: group.slug,
					reason: "Fine 1",
					amount: 50,
					createdByUserId: user.id,
					status: "pending",
				},
				{
					userId: targetUser2.user.id,
					groupSlug: group.slug,
					reason: "Fine 2",
					amount: 75,
					createdByUserId: user.id,
					status: "approved",
				},
			]);

			const response = await client.api.groups[":groupSlug"].fines.$get({
				param: { groupSlug: group.slug },
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(Array.isArray(json)).toBe(true);
			expect(json.length).toBe(2);
		},
		500_000,
	);

	integrationTest(
		"returns empty array for group with no fines",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:view"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const response = await client.api.groups[":groupSlug"].fines.$get({
				param: { groupSlug: group.slug },
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(Array.isArray(json)).toBe(true);
			expect(json.length).toBe(0);
		},
		500_000,
	);

	integrationTest(
		"fails to list fines without fines:view permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const response = await client.api.groups[":groupSlug"].fines.$get({
				param: { groupSlug: group.slug },
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 for non-existent group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:view"]);

			const response = await client.api.groups[":groupSlug"].fines.$get({
				param: { groupSlug: "non-existent" },
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);
});
