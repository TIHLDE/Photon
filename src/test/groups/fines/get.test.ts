import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("get fine", () => {
	integrationTest(
		"successfully gets a fine by id",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:view"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "target@test.com",
					name: "Target User",
					password: "test123!",
				},
			});

			const [fine] = await ctx.db
				.insert(schema.fine)
				.values({
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "Test fine",
					amount: 100,
					createdByUserId: user.id,
					status: "pending",
				})
				.returning();

			if (!fine) {
				throw new Error("Failed to create fine");
			}

			const response = await client.api.groups[":groupSlug"].fines[
				":fineId"
			].$get({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(json.id).toBe(fine.id);
			expect(json.reason).toBe("Test fine");
			expect(json.amount).toBe(100);
		},
		500_000,
	);

	integrationTest(
		"fails to get fine without fines:view permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

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

			const [fine] = await ctx.db
				.insert(schema.fine)
				.values({
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "No view permission",
					amount: 50,
					createdByUserId: user.id,
					status: "pending",
				})
				.returning();

			if (!fine) {
				throw new Error("Failed to create fine");
			}

			const response = await client.api.groups[":groupSlug"].fines[
				":fineId"
			].$get({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 for non-existent fine",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:view"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const response = await client.api.groups[":groupSlug"].fines[
				":fineId"
			].$get({
				param: { groupSlug: group.slug, fineId: "99999" },
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);
});
