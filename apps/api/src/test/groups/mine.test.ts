import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("list my groups", () => {
    integrationTest(
        "returns 401 for unauthenticated requests",
        async ({ ctx }) => {
            const response = await ctx.app.request("/api/groups/mine");

            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "returns empty array for users with no group memberships",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create a group but don't add the user to it
            await ctx.utils.createTestGroup({
                slug: "some-group",
                name: "Some Group",
            });

            const response = await client.api.groups.mine.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(Array.isArray(json)).toBe(true);
            expect(json.length).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "returns correct groups with membership info",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create test groups
            const group1 = await ctx.utils.createTestGroup({
                slug: "my-group-1",
                name: "My Group 1",
                description: "First group description",
            });
            const group2 = await ctx.utils.createTestGroup({
                slug: "my-group-2",
                name: "My Group 2",
                description: "Second group description",
            });

            // Add user as member to group1 and leader to group2
            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: user.id,
                    groupSlug: group1.slug,
                    role: "member",
                },
                {
                    userId: user.id,
                    groupSlug: group2.slug,
                    role: "leader",
                },
            ]);

            const response = await client.api.groups.mine.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(Array.isArray(json)).toBe(true);
            expect(json.length).toBe(2);

            // Check first group
            const returnedGroup1 = json.find((g) => g.slug === "my-group-1");
            expect(returnedGroup1).toBeDefined();
            expect(returnedGroup1?.name).toBe("My Group 1");
            expect(returnedGroup1?.description).toBe("First group description");
            expect(returnedGroup1?.membership).toBeDefined();
            expect(returnedGroup1?.membership.role).toBe("member");
            expect(returnedGroup1?.membership.joinedAt).toBeDefined();
            expect(returnedGroup1?.membership.updatedAt).toBeDefined();

            // Check second group
            const returnedGroup2 = json.find((g) => g.slug === "my-group-2");
            expect(returnedGroup2).toBeDefined();
            expect(returnedGroup2?.name).toBe("My Group 2");
            expect(returnedGroup2?.membership.role).toBe("leader");
        },
        500_000,
    );

    integrationTest(
        "returns groups ordered alphabetically by name",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create groups with names that would be out of alphabetical order by creation
            const groupC = await ctx.utils.createTestGroup({
                slug: "group-c",
                name: "Charlie Group",
            });
            const groupA = await ctx.utils.createTestGroup({
                slug: "group-a",
                name: "Alpha Group",
            });
            const groupB = await ctx.utils.createTestGroup({
                slug: "group-b",
                name: "Bravo Group",
            });

            // Add user to all groups
            await ctx.db.insert(schema.groupMembership).values([
                { userId: user.id, groupSlug: groupC.slug, role: "member" },
                { userId: user.id, groupSlug: groupA.slug, role: "member" },
                { userId: user.id, groupSlug: groupB.slug, role: "member" },
            ]);

            const response = await client.api.groups.mine.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.length).toBe(3);

            // Verify alphabetical order
            expect(json[0]?.name).toBe("Alpha Group");
            expect(json[1]?.name).toBe("Bravo Group");
            expect(json[2]?.name).toBe("Charlie Group");
        },
        500_000,
    );

    integrationTest(
        "does not return groups user is not a member of",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create another user and add them to a group
            const otherUser = await ctx.auth.api.createUser({
                body: {
                    email: "other@test.com",
                    name: "Other User",
                    password: "test123!",
                },
            });

            const myGroup = await ctx.utils.createTestGroup({
                slug: "my-only-group",
                name: "My Only Group",
            });
            const otherGroup = await ctx.utils.createTestGroup({
                slug: "other-group",
                name: "Other Group",
            });

            // Add current user to myGroup only
            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: myGroup.slug,
                role: "member",
            });

            // Add other user to otherGroup
            await ctx.db.insert(schema.groupMembership).values({
                userId: otherUser.user.id,
                groupSlug: otherGroup.slug,
                role: "member",
            });

            const response = await client.api.groups.mine.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.length).toBe(1);
            expect(json[0]?.slug).toBe("my-only-group");

            // Make sure other group is not included
            const slugs = json.map((g) => g.slug);
            expect(slugs).not.toContain("other-group");
        },
        500_000,
    );
});
