import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("update fine", () => {
	integrationTest(
		"successfully updates fine status from pending to approved",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:update"]);

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
					reason: "Late arrival",
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
			].$patch({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
				json: {
					status: "approved",
				},
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(json.message).toBe("Fine updated successfully");
		},
		500_000,
	);

	integrationTest(
		"successfully updates fine status to rejected",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:update"]);

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
					reason: "Rejected fine",
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
			].$patch({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
				json: {
					status: "rejected",
				},
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(json.message).toBe("Fine updated successfully");
		},
		500_000,
	);

	integrationTest(
		"fails to update fine without fines:update permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const targetUser = await ctx.auth.api.createUser({
				body: {
					email: "noperm@test.com",
					name: "No Permission",
					password: "test123!",
				},
			});

			const [fine] = await ctx.db
				.insert(schema.fine)
				.values({
					userId: targetUser.user.id,
					groupSlug: group.slug,
					reason: "No permission",
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
			].$patch({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
				json: {
					status: "approved",
				},
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 when updating non-existent fine",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:update"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const response = await client.api.groups[":groupSlug"].fines[
				":fineId"
			].$patch({
				param: { groupSlug: group.slug, fineId: "99999" },
				json: {
					status: "approved",
				},
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);
});
