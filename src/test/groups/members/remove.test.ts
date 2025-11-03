import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

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
                param: { groupSlug: group.slug, userId: memberUser.user.id },
            });

            expect(response.status).toBe(204);

            // Verify member was removed
            const membership = await ctx.db.query.groupMembership.findFirst({
                where: (m, { and, eq }) =>
                    and(
                        eq(m.userId, memberUser.user.id),
                        eq(m.groupSlug, group.slug),
                    ),
            });

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
                param: { groupSlug: group.slug, userId: memberUser.user.id },
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
                param: { groupSlug: group.slug, userId: "non-existent-user" },
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
