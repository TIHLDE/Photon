import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("list groups", () => {
	integrationTest(
		"successfully lists all groups",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			// Create some test groups
			await ctx.utils.createTestGroup({ slug: "group-1", name: "Group 1" });
			await ctx.utils.createTestGroup({ slug: "group-2", name: "Group 2" });
			await ctx.utils.createTestGroup({ slug: "group-3", name: "Group 3" });

			const response = await client.api.groups.$get();

			expect(response.status).toBe(200);

			const json = await response.json();
			expect(Array.isArray(json)).toBe(true);
			expect(json.length).toBeGreaterThanOrEqual(3);

			// Check that our test groups are in the list
			const slugs = json.map((g) => g.slug);
			expect(slugs).toContain("group-1");
			expect(slugs).toContain("group-2");
			expect(slugs).toContain("group-3");
		},
		500_000,
	);

	integrationTest(
		"lists groups without authentication",
		async ({ ctx }) => {
			const client = ctx.app.request;

			await ctx.utils.createTestGroup({ slug: "public-group" });

			const response = await client("/api/groups");

			expect(response.status).toBe(200);
		},
		500_000,
	);
});
