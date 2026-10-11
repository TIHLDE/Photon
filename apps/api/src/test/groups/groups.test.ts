import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
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
                    query: { confirm: group.slug },
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
                    query: { confirm: group.slug },
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
                    query: { confirm: "non-existent" },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "the leader may delete their own group, but only by typing its slug",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const member = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup({
                    slug: "slettes",
                });
                await ctx.db.insert(schema.groupMembership).values([
                    {
                        userId: leader.id,
                        groupSlug: group.slug,
                        role: "leader",
                    },
                    {
                        userId: member.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                ]);
                const leaderClient = await ctx.utils.clientForUser(leader);
                const memberClient = await ctx.utils.clientForUser(member);

                const asMember = await memberClient.api.groups[":slug"].$delete(
                    {
                        param: { slug: group.slug },
                        query: { confirm: group.slug },
                    },
                );
                expect(asMember.status).toBe(403);

                const mistyped = await leaderClient.api.groups[":slug"].$delete(
                    {
                        param: { slug: group.slug },
                        query: { confirm: "slette" },
                    },
                );
                expect(mistyped.status).toBe(400);

                const stillThere = await ctx.db.query.group.findFirst({
                    where: eq(schema.group.slug, group.slug),
                });
                expect(stillThere).toBeDefined();

                const deleted = await leaderClient.api.groups[":slug"].$delete({
                    param: { slug: group.slug },
                    query: { confirm: group.slug },
                });
                expect(deleted.status).toBe(204);
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

    /**
     * A `private` group is the members' own — the digital
     * transformasjon-faddergruppa is the standing example. Its name still
     * appears wherever memberships are listed, so the page and the roster are
     * what actually have to be closed.
     */
    describe("private groups", () => {
        integrationTest(
            "a member may open a private group and see its roster",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "private-member-group",
                    type: "PRIVATE",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const detail = await client.api.groups[":slug"].$get({
                    param: { slug: group.slug },
                });
                expect(detail.status).toBe(200);

                const members = await client.api.groups[
                    ":groupSlug"
                ].members.$get({ param: { groupSlug: group.slug } });
                expect(members.status).toBe(200);
            },
            500_000,
        );

        integrationTest(
            "a signed-in non-member is refused the group and its roster",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "private-outsider-group",
                    type: "PRIVATE",
                });

                const detail = await client.api.groups[":slug"].$get({
                    param: { slug: group.slug },
                });
                expect(detail.status).toBe(403);

                const members = await client.api.groups[
                    ":groupSlug"
                ].members.$get({ param: { groupSlug: group.slug } });
                expect(members.status).toBe(403);

                const former = await client.api.groups[
                    ":groupSlug"
                ].members.history.$get({ param: { groupSlug: group.slug } });
                expect(former.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "a signed-out visitor is refused a private group",
            async ({ ctx }) => {
                const group = await ctx.utils.createTestGroup({
                    slug: "private-anonymous-group",
                    type: "PRIVATE",
                });

                const response = await ctx.app.request(
                    `/api/groups/${group.slug}`,
                );

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "groups:manage still opens a private group, so the admin panel works",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);
                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "private-admin-group",
                    type: "PRIVATE",
                });

                const response = await client.api.groups[":slug"].$get({
                    param: { slug: group.slug },
                });

                expect(response.status).toBe(200);
            },
            500_000,
        );

        integrationTest(
            "groups:view — which every member holds — does not open one",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);
                await ctx.utils.giveUserPermissions(user, ["groups:view"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "private-viewer-group",
                    type: "PRIVATE",
                });

                const response = await client.api.groups[":slug"].$get({
                    param: { slug: group.slug },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );
    });

    describe("archived groups", () => {
        integrationTest(
            "an archived group leaves the list and only its members can open it",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const member = await ctx.utils.createTestUser();
                const outsider = await ctx.utils.createTestUser();
                const leaderClient = await ctx.utils.clientForUser(leader);
                const memberClient = await ctx.utils.clientForUser(member);
                const outsiderClient = await ctx.utils.clientForUser(outsider);

                const group = await ctx.utils.createTestGroup({
                    slug: "archive-visibility",
                });
                await ctx.db.insert(schema.groupMembership).values([
                    {
                        userId: leader.id,
                        groupSlug: group.slug,
                        role: "leader",
                    },
                    {
                        userId: member.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                ]);

                const refused = await outsiderClient.api.groups[
                    ":slug"
                ].archive.$post({ param: { slug: group.slug } });
                expect(refused.status).toBe(403);

                const archived = await leaderClient.api.groups[
                    ":slug"
                ].archive.$post({ param: { slug: group.slug } });
                expect(archived.status).toBe(200);

                const active = await memberClient.api.groups.$get({
                    query: {},
                });
                expect((await active.json()).map((g) => g.slug)).not.toContain(
                    group.slug,
                );

                const forMember = await memberClient.api.groups.$get({
                    query: { archived: "true" },
                });
                expect((await forMember.json()).map((g) => g.slug)).toEqual([
                    group.slug,
                ]);

                const forOutsider = await outsiderClient.api.groups.$get({
                    query: { archived: "true" },
                });
                expect(await forOutsider.json()).toEqual([]);

                const signedOut = await ctx.app.request(
                    "/api/groups?archived=true",
                );
                expect(await signedOut.json()).toEqual([]);

                const detail = await memberClient.api.groups[":slug"].$get({
                    param: { slug: group.slug },
                });
                expect(detail.status).toBe(200);
                expect((await detail.json()).archivedAt).not.toBeNull();

                const outsiderDetail = await outsiderClient.api.groups[
                    ":slug"
                ].$get({ param: { slug: group.slug } });
                expect(outsiderDetail.status).toBe(403);

                const outsiderMembers = await outsiderClient.api.groups[
                    ":groupSlug"
                ].members.$get({ param: { groupSlug: group.slug } });
                expect(outsiderMembers.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "groups:manage sees every archived group",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.giveUserPermissions(admin, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "archive-admin-view",
                });
                await ctx.db
                    .update(schema.group)
                    .set({ archivedAt: new Date() })
                    .where(eq(schema.group.slug, group.slug));

                const list = await client.api.groups.$get({
                    query: { archived: "true" },
                });
                expect((await list.json()).map((g) => g.slug)).toContain(
                    group.slug,
                );

                const detail = await client.api.groups[":slug"].$get({
                    param: { slug: group.slug },
                });
                expect(detail.status).toBe(200);
            },
            500_000,
        );

        integrationTest(
            "nothing can be changed until the group is restored",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const newcomer = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);

                const group = await ctx.utils.createTestGroup({
                    slug: "archive-read-only",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                await client.api.groups[":slug"].archive.$post({
                    param: { slug: group.slug },
                });

                const update = await client.api.groups[":slug"].$patch({
                    param: { slug: group.slug },
                    json: { name: "Renamed" },
                });
                expect(update.status).toBe(409);

                const addMember = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: { userId: newcomer.id, role: "member" },
                });
                expect(addMember.status).toBe(409);

                // The leader's id repeats the slug's position at the end of
                // the path; only "DELETE /:slug" itself may pass the guard.
                const removeMember = await client.api.groups[
                    ":groupSlug"
                ].members[":userId"].$delete({
                    param: { groupSlug: group.slug, userId: group.slug },
                });
                expect(removeMember.status).toBe(409);

                const archiveAgain = await client.api.groups[
                    ":slug"
                ].archive.$post({ param: { slug: group.slug } });
                expect(archiveAgain.status).toBe(409);

                const restored = await client.api.groups[
                    ":slug"
                ].unarchive.$post({ param: { slug: group.slug } });
                expect(restored.status).toBe(200);

                const updateAgain = await client.api.groups[":slug"].$patch({
                    param: { slug: group.slug },
                    json: { name: "Renamed" },
                });
                expect(updateAgain.status).toBe(200);

                const active = await client.api.groups.$get({ query: {} });
                expect((await active.json()).map((g) => g.slug)).toContain(
                    group.slug,
                );
            },
            500_000,
        );

        integrationTest(
            "an archived group can still be deleted",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);

                const group = await ctx.utils.createTestGroup({
                    slug: "archive-then-delete",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                await client.api.groups[":slug"].archive.$post({
                    param: { slug: group.slug },
                });

                const deleted = await client.api.groups[":slug"].$delete({
                    param: { slug: group.slug },
                    query: { confirm: group.slug },
                });
                expect(deleted.status).toBe(204);
            },
            500_000,
        );

        integrationTest(
            "an archived group grants no permissions until it is restored",
            async ({ ctx }) => {
                const member = await ctx.utils.createTestUser();

                const group = await ctx.utils.createTestGroup({
                    slug: "archive-permissions",
                });
                await ctx.db
                    .update(schema.group)
                    .set({ memberGlobalPermissions: ["news:create"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                expect(await hasPermission(ctx, member.id, "news:create")).toBe(
                    true,
                );

                await ctx.db
                    .update(schema.group)
                    .set({ archivedAt: new Date() })
                    .where(eq(schema.group.slug, group.slug));
                expect(await hasPermission(ctx, member.id, "news:create")).toBe(
                    false,
                );

                await ctx.db
                    .update(schema.group)
                    .set({ archivedAt: null })
                    .where(eq(schema.group.slug, group.slug));
                expect(await hasPermission(ctx, member.id, "news:create")).toBe(
                    true,
                );
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

                const response = await client.api.groups.$get({ query: {} });

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
            "promotes gruppebilde and logo so the staging cleanup spares them",
            async ({ ctx }) => {
                const { db, bucket } = ctx;

                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);
                await ctx.utils.giveUserPermissions(user, ["groups:update"]);

                const group = await ctx.utils.createTestGroup({
                    slug: "picture-test",
                });

                const imageKey = await bucket.upload(
                    "uploads/2026/08/gruppebilde.png",
                    Buffer.from("wide photo"),
                    {
                        originalFilename: "gruppebilde.png",
                        contentType: "image/png",
                    },
                );
                const logoKey = await bucket.upload(
                    "uploads/2026/08/logo.png",
                    Buffer.from("square mark"),
                    {
                        originalFilename: "logo.png",
                        contentType: "image/png",
                    },
                );

                const response = await client.api.groups[":slug"].$patch({
                    param: { slug: group.slug },
                    json: {
                        imageUrl: `http://localhost/api/assets/${imageKey}`,
                        logoUrl: `http://localhost/api/assets/${logoKey}`,
                    },
                });

                expect(response.status).toBe(200);

                const promoted = await db.query.asset.findMany({
                    where: eq(schema.asset.status, "ready"),
                });
                expect(promoted.map((a) => a.key)).toEqual(
                    expect.arrayContaining([imageKey, logoKey]),
                );
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
