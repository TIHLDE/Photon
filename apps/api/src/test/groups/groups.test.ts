import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Consolidated tests for group CRUD operations.
 * Combines: create.test.ts, delete.test.ts, get.test.ts, list.test.ts, update.test.ts
 */

describe("groups", () => {
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

    describe("list groups", () => {
        integrationTest(
            "successfully lists all groups",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                // Create some test groups
                await ctx.utils.createTestGroup({
                    slug: "group-1",
                    name: "Group 1",
                });
                await ctx.utils.createTestGroup({
                    slug: "group-2",
                    name: "Group 2",
                });
                await ctx.utils.createTestGroup({
                    slug: "group-3",
                    name: "Group 3",
                });

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

    describe("update group", () => {
        integrationTest(
            "successfully updates a group with valid permissions",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:update"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "update-test",
                    name: "Original Name",
                });

                const response = await client.api.groups[":slug"].$patch({
                    param: { slug: group.slug },
                    json: {
                        name: "Updated Name",
                        description: "Updated description",
                    },
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(json.message).toBe("Group updated successfully");
            },
            500_000,
        );

        integrationTest(
            "fails to update group without groups:update permission",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "no-permission-update",
                });

                const response = await client.api.groups[":slug"].$patch({
                    param: { slug: group.slug },
                    json: {
                        name: "Should Fail",
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "returns 404 when updating non-existent group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:update"]);

                const response = await client.api.groups[":slug"].$patch({
                    param: { slug: "non-existent" },
                    json: {
                        name: "Should 404",
                    },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "successfully updates fines settings",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:update"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "fines-update-test",
                    finesActivated: false,
                });

                const response = await client.api.groups[":slug"].$patch({
                    param: { slug: group.slug },
                    json: {
                        finesActivated: true,
                        finesInfo: "New fines policy",
                        finesAdminId: user.id,
                    },
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(json.message).toBe("Group updated successfully");
            },
            500_000,
        );
    });
});
