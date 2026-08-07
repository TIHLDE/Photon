import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
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
            "a group's leader may add a plain member without groups:manage",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);

                const group = await ctx.utils.createTestGroup();
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const memberUser = await ctx.auth.api.createUser({
                    body: {
                        email: "led-member@test.com",
                        name: "Led Member",
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
            },
            500_000,
        );

        integrationTest(
            "a group's leader may not add another leader",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);

                const group = await ctx.utils.createTestGroup();
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const other = await ctx.auth.api.createUser({
                    body: {
                        email: "would-be-leader@test.com",
                        name: "Would Be Leader",
                        password: "test123!",
                    },
                });

                // Leadership carries the group's leader role and, for
                // subgroups, a seat in HS — that stays with groups:manage.
                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: other.user.id,
                        role: "leader",
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

                await ctx.db
                    .update(schema.user)
                    .set({ username: "member1" })
                    .where(eq(schema.user.id, member1.user.id));

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

                // Each member includes public user info for display
                const m1 = json.find((m) => m.userId === member1.user.id);
                const m2 = json.find((m) => m.userId === member2.user.id);
                expect(m1?.user).toMatchObject({
                    id: member1.user.id,
                    name: "Member 1",
                    username: "member1",
                });
                expect(m2?.user).toMatchObject({
                    id: member2.user.id,
                    name: "Member 2",
                });
                // No sensitive fields leak through the user relation
                expect(m1?.user).not.toHaveProperty("email");
            },
            500_000,
        );

        integrationTest(
            "includes study programme and cohort derived from the member's study groups",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "study-list",
                });
                // Lepton stores these types in UPPERCASE — the route has to
                // match case-insensitively, so seed them that way.
                const study = await ctx.utils.createTestGroup({
                    slug: "dataingenior",
                    name: "Dataingeniør",
                    type: "STUDY",
                });
                const olderCohort = await ctx.utils.createTestGroup({
                    slug: "2021",
                    name: "2021",
                    type: "STUDYYEAR",
                });
                const cohort = await ctx.utils.createTestGroup({
                    slug: "2024",
                    name: "2024",
                    type: "STUDYYEAR",
                });

                const student = await ctx.auth.api.createUser({
                    body: {
                        email: "student@test.com",
                        name: "Student",
                        password: "test123!",
                    },
                });
                const alumni = await ctx.auth.api.createUser({
                    body: {
                        email: "alumni@test.com",
                        name: "Alumni",
                        password: "test123!",
                    },
                });

                await ctx.db.insert(schema.groupMembership).values([
                    {
                        userId: student.user.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                    {
                        userId: student.user.id,
                        groupSlug: study.slug,
                        role: "member",
                    },
                    {
                        userId: student.user.id,
                        groupSlug: olderCohort.slug,
                        role: "member",
                    },
                    {
                        userId: student.user.id,
                        groupSlug: cohort.slug,
                        role: "member",
                    },
                    {
                        userId: alumni.user.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                ]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                const studentRow = json.find(
                    (m) => m.userId === student.user.id,
                );
                const alumniRow = json.find((m) => m.userId === alumni.user.id);

                expect(studentRow?.user).toMatchObject({
                    studyProgram: "Dataingeniør",
                    // The most recent cohort wins when someone has several.
                    studyStartYear: 2024,
                });
                expect(alumniRow?.user).toMatchObject({
                    studyProgram: null,
                    studyStartYear: null,
                });
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

    describe("former members (membership history)", () => {
        integrationTest(
            "records the stint when a member is removed",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();
                const member = await ctx.auth.api.createUser({
                    body: {
                        email: "former@test.com",
                        name: "Former Member",
                        password: "test123!",
                    },
                });

                await ctx.db
                    .update(schema.user)
                    .set({ username: "former" })
                    .where(eq(schema.user.id, member.user.id));

                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: {
                        groupSlug: group.slug,
                        userId: member.user.id,
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.history.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json).toHaveLength(1);
                expect(json[0]?.userId).toBe(member.user.id);
                expect(json[0]?.role).toBe("leader");
                expect(json[0]?.user.name).toBe("Former Member");
                expect(json[0]?.user.username).toBe("former");
                // The stint starts when they joined, not when they left.
                expect(
                    new Date(json[0]?.startedAt ?? 0).getTime(),
                ).toBeLessThanOrEqual(
                    new Date(json[0]?.endedAt ?? 0).getTime(),
                );
            },
            500_000,
        );

        integrationTest(
            "excludes someone who rejoined the group",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();
                const member = await ctx.auth.api.createUser({
                    body: {
                        email: "rejoiner@test.com",
                        name: "Rejoining Member",
                        password: "test123!",
                    },
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.user.id,
                    groupSlug: group.slug,
                    role: "member",
                });
                await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: { groupSlug: group.slug, userId: member.user.id },
                });
                await client.api.groups[":groupSlug"].members.$post({
                    param: { groupSlug: group.slug },
                    json: { userId: member.user.id, role: "member" },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.history.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);
                expect(await response.json()).toHaveLength(0);
            },
            500_000,
        );

        integrationTest(
            "lists a member with several stints once, by the most recent",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup();
                const member = await ctx.auth.api.createUser({
                    body: {
                        email: "twostints@test.com",
                        name: "Two Stints",
                        password: "test123!",
                    },
                });

                // First stint: an ordinary member.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.user.id,
                    groupSlug: group.slug,
                    role: "member",
                });
                await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: { groupSlug: group.slug, userId: member.user.id },
                });

                // Second stint: back as leader, then gone again.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$delete({
                    param: { groupSlug: group.slug, userId: member.user.id },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.history.$get({
                    param: { groupSlug: group.slug },
                });

                const json = await response.json();
                expect(json).toHaveLength(1);
                expect(json[0]?.role).toBe("leader");

                // Both periods are still stored — only the display folds them.
                const stored =
                    await ctx.db.query.groupMembershipHistory.findMany({
                        where: (h, { eq }) => eq(h.userId, member.user.id),
                    });
                expect(stored).toHaveLength(2);
            },
            500_000,
        );

        integrationTest(
            "returns 404 for an unknown group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.history.$get({
                    param: { groupSlug: "does-not-exist" },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );
    });
});
