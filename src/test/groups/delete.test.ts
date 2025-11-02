import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("delete group", () => {
	integrationTest(
		"successfully deletes a group with valid permissions",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:delete"]);

			const group = await ctx.utils.createTestGroup({
				slug: "delete-test",
			});

			const response = await client.api.groups[":slug"].$delete({
				param: { slug: group.slug },
			});

			expect(response.status).toBe(204);

			// Verify group is deleted
			const getResponse = await client.api.groups[":slug"].$get({
				param: { slug: group.slug },
			});
			expect(getResponse.status).toBe(404);
		},
		500_000,
	);

	integrationTest(
		"fails to delete group without groups:delete permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup({
				slug: "no-permission-delete",
			});

			const response = await client.api.groups[":slug"].$delete({
				param: { slug: group.slug },
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"returns 404 when deleting non-existent group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:delete"]);

			const response = await client.api.groups[":slug"].$delete({
				param: { slug: "non-existent" },
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);
});
