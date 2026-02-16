import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Consolidated tests for group member operations.
 * Combines: members/add.test.ts, members/remove.test.ts, members/list.test.ts, members/update.test.ts
 */

describe("group members", () => {
    describe("add group member", () => {
        integrationTest(
            "successfully adds a member to a group with groups:manage permission",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "test-group",
                });

                // Create another user to add as member
                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "member@test.com",
                        name: "Member User",
                        password: "test123!",
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: memberUser.user.id,
                        role: "member",
                    },
                });

                expect(response.status).toBe(201);

                const json = await response.json();
                expect(json.userId).toBe(memberUser.user.id);
                expect(json.groupSlug).toBe(group.slug);
                expect(json.role).toBe("member");
            },
            500_000,
        );

        integrationTest(
            "successfully adds a leader to a group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const leaderUser = await ctx.auth.api.createUser({
                    body: {
                        email: "leader@test.com",
                        name: "Leader User",
                        password: "test123!",
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: leaderUser.user.id,
                        role: "leader",
                    },
                });

                expect(response.status).toBe(201);

                const json = await response.json();
                expect(json.role).toBe("leader");
            },
            500_000,
        );

        integrationTest(
            "fails to add member without groups:manage permission",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup();

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "noperm@test.com",
                        name: "No Permission",
                        password: "test123!",
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: memberUser.user.id,
                        role: "member",
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "returns 404 when adding member to non-existent group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "member@test.com",
                        name: "Member User",
                        password: "test123!",
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: "non-existent-group" },
                    json: {
                        userId: memberUser.user.id,
                        role: "member",
                    },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "fails to add non-existent user as member",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: "non-existent-user",
                        role: "member",
                    },
                });

                expect(response.status).toBe(400);
            },
            500_000,
        );

        integrationTest(
            "fails to add user who is already a member",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "duplicate@test.com",
                        name: "Duplicate Member",
                        password: "test123!",
                    },
                });

                // Add member first time
                await client.api.groups[":groupSlug"].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: memberUser.user.id,
                        role: "member",
                    },
                });

                // Try to add again
                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: memberUser.user.id,
                        role: "member",
                    },
                });

                expect(response.status).toBe(400);
            },
            500_000,
        );
    });

    describe("remove group member", () => {
        integrationTest(
            "successfully removes a member from a group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "remove@test.com",
                        name: "Remove Me",
                        password: "test123!",
                    },
                });

                // Add member
                await ctx.db.insert(schema.groupMembership).values({
                    userId: memberUser.user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                // Remove member
                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: {
                        groupSlug: group.slug,
                        userId: memberUser.user.id,
                    },
                });

                expect(response.status).toBe(204);

                // Verify member was removed
                const membership = await ctx.db.query.groupMembership.findFirst(
                    {
                        where: (m, { and, eq }) =>
                            and(
                                eq(m.userId, memberUser.user.id),
                                eq(m.groupSlug, group.slug),
                            ),
                    },
                );

                expect(membership).toBeUndefined();
            },
            500_000,
        );

        integrationTest(
            "fails to remove member without groups:manage permission",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup();

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "noperm@test.com",
                        name: "No Permission",
                        password: "test123!",
                    },
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: memberUser.user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: {
                        groupSlug: group.slug,
                        userId: memberUser.user.id,
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "returns 404 when removing non-existent membership",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: {
                        groupSlug: group.slug,
                        userId: "non-existent-user",
                    },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "returns 404 when removing member from non-existent group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: { groupSlug: "non-existent", userId: "some-user" },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );
    });

    describe("list group members", () => {
        integrationTest(
            "successfully lists all members of a group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "member-list",
                });

                // Add some members
                const member1 = await ctx.auth.api.createUser({
                    body: {
                        email: "member1@test.com",
                        name: "Member 1",
                        password: "test123!",
                    },
                });

                const member2 = await ctx.auth.api.createUser({
                    body: {
                        email: "member2@test.com",
                        name: "Member 2",
                        password: "test123!",
                    },
                });

                await ctx.db.insert(schema.groupMembership).values([
                    {
                        userId: member1.user.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                    {
                        userId: member2.user.id,
                        groupSlug: group.slug,
                        role: "leader",
                    },
                ]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(Array.isArray(json)).toBe(true);
                expect(json.length).toBe(2);

                const userIds = json.map((m) => m.userId);
                expect(userIds).toContain(member1.user.id);
                expect(userIds).toContain(member2.user.id);
            },
            500_000,
        );

        integrationTest(
            "returns empty array for group with no members",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "empty-group",
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$get({
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
            "returns 404 for non-existent group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$get({
                    param: { groupSlug: "non-existent" },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );
    });

    describe("update group member", () => {
        integrationTest(
            "successfully updates member role from member to leader",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "member@test.com",
                        name: "Member User",
                        password: "test123!",
                    },
                });

                // Add as member
                await ctx.db.insert(schema.groupMembership).values({
                    userId: memberUser.user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                // Update to leader
                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$patch({
                    param: {
                        groupSlug: group.slug,
                        userId: memberUser.user.id,
                    },
                    json: {
                        role: "leader",
                    },
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(json.message).toBe("Member role updated successfully");
            },
            500_000,
        );

        integrationTest(
            "successfully updates member role from leader to member",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const leaderUser = await ctx.auth.api.createUser({
                    body: {
                        email: "leader@test.com",
                        name: "Leader User",
                        password: "test123!",
                    },
                });

                // Add as leader
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leaderUser.user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                // Update to member
                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$patch({
                    param: {
                        groupSlug: group.slug,
                        userId: leaderUser.user.id,
                    },
                    json: {
                        role: "member",
                    },
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(json.message).toBe("Member role updated successfully");
            },
            500_000,
        );

        integrationTest(
            "fails to update member without groups:manage permission",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup();

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "member@test.com",
                        name: "Member User",
                        password: "test123!",
                    },
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: memberUser.user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$patch({
                    param: {
                        groupSlug: group.slug,
                        userId: memberUser.user.id,
                    },
                    json: {
                        role: "leader",
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "returns 404 when updating non-existent membership",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();

                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$patch({
                    param: {
                        groupSlug: group.slug,
                        userId: "non-existent-user",
                    },
                    json: {
                        role: "leader",
                    },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );
    });
});
