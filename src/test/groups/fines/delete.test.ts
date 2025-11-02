import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("delete fine", () => {
	integrationTest(
		"successfully deletes a fine with fines:delete permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:delete"]);

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
					reason: "Delete this",
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
			].$delete({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
			});

			expect(response.status).toBe(204);

			// Verify fine was deleted
			const deletedFine = await ctx.db.query.fine.findFirst({
				where: (f, { eq }) => eq(f.id, fine.id),
			});

			expect(deletedFine).toBeUndefined();
		},
		500_000,
	);

	integrationTest(
		"fails to delete fine without fines:delete permission",
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
					reason: "Cannot delete",
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
			].$delete({
				param: { groupSlug: group.slug, fineId: fine.id.toString() },
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 when deleting non-existent fine",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["fines:delete"]);

			const group = await ctx.utils.createTestGroup({
				finesActivated: true,
			});

			const response = await client.api.groups[":groupSlug"].fines[
				":fineId"
			].$delete({
				param: { groupSlug: group.slug, fineId: "99999" },
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);
});
