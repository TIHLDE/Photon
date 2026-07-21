import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Membership of `study` and `studyyear` groups is rebuilt from Feide on every
 * login, so the write routes refuse to touch it rather than let a hand edit
 * and NTNU's answer drift apart.
 */
describe("derived group membership", () => {
    const derivedTypes = ["study", "studyyear", "STUDY", "STUDYYEAR"];

    for (const type of derivedTypes) {
        integrationTest(
            `refuses to add a member to a '${type}' group`,
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);
                await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

                const group = await ctx.utils.createTestGroup({
                    slug: `derived-add-${type}`,
                    type,
                });

                const target = await ctx.auth.api.createUser({
                    body: {
                        email: `derived-add-${type}@test.com`,
                        name: "Target",
                        password: "test123!",
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].members.$post({
                    param: { groupSlug: group.slug },
                    json: { userId: target.user.id, role: "member" },
                });

                expect(response.status).toBe(400);

                const stored = await ctx.db
                    .select()
                    .from(schema.groupMembership)
                    .where(eq(schema.groupMembership.groupSlug, group.slug));
                expect(stored).toHaveLength(0);
            },
            500_000,
        );
    }

    integrationTest(
        "refuses to remove a derived membership",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

            const group = await ctx.utils.createTestGroup({
                slug: "derived-remove",
                type: "STUDYYEAR",
            });

            await ctx.db.insert(schema.groupMembership).values({
                userId: user.id,
                groupSlug: group.slug,
                role: "member",
            });

            const response = await client.api.groups[":groupSlug"].members[
                ":userId"
            ].$delete({
                param: { groupSlug: group.slug, userId: user.id },
            });

            expect(response.status).toBe(400);

            // The membership must survive the refused call.
            const stored = await ctx.db.query.groupMembership.findFirst({
                where: and(
                    eq(schema.groupMembership.userId, user.id),
                    eq(schema.groupMembership.groupSlug, group.slug),
                ),
            });
            expect(stored).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "still allows editing an ordinary group",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["groups:manage"]);

            const group = await ctx.utils.createTestGroup({
                slug: "ordinary-group",
                type: "COMMITTEE",
            });

            const target = await ctx.auth.api.createUser({
                body: {
                    email: "ordinary@test.com",
                    name: "Target",
                    password: "test123!",
                },
            });

            const response = await client.api.groups[
                ":groupSlug"
            ].members.$post({
                param: { groupSlug: group.slug },
                json: { userId: target.user.id, role: "member" },
            });

            expect(response.status).toBe(201);
        },
        500_000,
    );
});
