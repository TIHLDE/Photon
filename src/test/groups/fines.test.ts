import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

/**
 * Consolidated tests for fines operations.
 * Combines: fines/create.test.ts, fines/delete.test.ts, fines/get.test.ts, fines/list.test.ts, fines/update.test.ts
 */

describe("fines", () => {
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
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

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: "non-existent" },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );
    });

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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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
                    param: {
                        groupSlug: group.slug,
                        fineId: fine.id.toString(),
                    },
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
});
