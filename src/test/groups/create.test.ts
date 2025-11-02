import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("create group", () => {
	integrationTest(
		"successfully creates a group with valid data and permissions",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:create"]);

			const response = await client.api.groups.$post({
				json: {
					slug: "new-committee",
					name: "New Committee",
					description: "A brand new committee",
					contactEmail: "contact@committee.org",
					type: "committee",
					finesInfo: "No fines yet",
					finesActivated: false,
				},
			});

			expect(response.status).toBe(201);

			const json = await response.json();
			expect(json.slug).toBe("new-committee");
			expect(json.name).toBe("New Committee");
		},
		500_000,
	);

	integrationTest(
		"fails to create group without groups:create permission",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			const response = await client.api.groups.$post({
				json: {
					slug: "no-permission-group",
					name: "No Permission Group",
					type: "committee",
					finesInfo: "",
					finesActivated: false,
				},
			});

			expect(response.status).toBe(403);
		},
		500_000,
	);

	integrationTest(
		"fails to create group with duplicate slug",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:create"]);

			// Create first group
			await ctx.utils.createTestGroup({ slug: "duplicate-slug" });

			// Try to create another with same slug
			const response = await client.api.groups.$post({
				json: {
					slug: "duplicate-slug",
					name: "Duplicate Group",
					type: "committee",
					finesInfo: "",
					finesActivated: false,
				},
			});

			expect(response.status).toBe(400);
		},
		500_000,
	);

	integrationTest(
		"fails to create group with invalid slug format",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:create"]);

			const response = await client.api.groups.$post({
				json: {
					slug: "Invalid_Slug!", // Contains uppercase and special chars
					name: "Invalid Slug Group",
					type: "committee",
					finesInfo: "",
					finesActivated: false,
				},
			});

			expect(response.status).toBe(400);
		},
		500_000,
	);

	integrationTest(
		"successfully creates group with fines activated and admin",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:create"]);

			const response = await client.api.groups.$post({
				json: {
					slug: "fines-group",
					name: "Fines Group",
					type: "committee",
					finesInfo: "Fines policy here",
					finesActivated: true,
					finesAdminId: user.id,
				},
			});

			expect(response.status).toBe(201);

			const json = await response.json();
			expect(json.finesActivated).toBe(true);
			expect(json.finesAdminId).toBe(user.id);
		},
		500_000,
	);

	integrationTest(
		"fails to create group with non-existent fines admin",
		async ({ ctx }) => {
			const user = await ctx.utils.createTestUser();
			const client = await ctx.utils.clientForUser(user);

			await ctx.utils.giveUserPermissions(user, ["groups:create"]);

			const response = await client.api.groups.$post({
				json: {
					slug: "invalid-admin",
					name: "Invalid Admin Group",
					type: "committee",
					finesInfo: "",
					finesActivated: true,
					finesAdminId: "nonexistent123",
				},
			});

			expect(response.status).toBe(400);
		},
		500_000,
	);
});
