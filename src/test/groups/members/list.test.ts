import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

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

            const response = await client.api.groups[":groupSlug"].members.$get(
                {
                    param: { groupSlug: group.slug },
                },
            );

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

            const response = await client.api.groups[":groupSlug"].members.$get(
                {
                    param: { groupSlug: group.slug },
                },
            );

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

            const response = await client.api.groups[":groupSlug"].members.$get(
                {
                    param: { groupSlug: "non-existent" },
                },
            );

            expect(response.status).toBe(404);
        },
        500_000,
    );
});
