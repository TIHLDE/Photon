import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("get group", () => {
	integrationTest(
		"successfully gets a group by slug",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const group = await ctx.utils.createTestGroup({
				slug: "test-get-group",
				name: "Test Get Group",
				description: "A group for testing get endpoint",
			});

			const response = await client.api.groups[":slug"].$get({
				param: { slug: group.slug },
			});

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(json.slug).toBe(group.slug);
			expect(json.name).toBe(group.name);
			expect(json.description).toBe(group.description);
		},
		500_000,
	);

	integrationTest(
		"returns 404 for non-existent group",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const response = await client.api.groups[":slug"].$get({
				param: { slug: "non-existent-group" },
			});

			expect(response.status).toBe(404);
		},
		500_000,
	);

	integrationTest(
		"gets group without authentication",
		async ({ ctx }) => {
			const client = ctx.app.request;

			const group = await ctx.utils.createTestGroup({
				slug: "public-get-group",
			});

			const response = await client(`/api/groups/${group.slug}`);

			expect(response.status).toBe(200);
		},
		500_000,
	);
});
