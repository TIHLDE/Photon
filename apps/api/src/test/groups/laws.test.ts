import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("laws", () => {
    describe("create law", () => {
        integrationTest(
            "successfully creates a law as group leader",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-group",
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].laws.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        paragraph: 1.01,
                        title: "Forsentkomming",
                        description: "Møter for sent til trening",
                        amount: 2,
                    },
                });

                expect(response.status).toBe(201);
                const json = await response.json();
                expect(json.groupSlug).toBe(group.slug);
                expect(json.paragraph).toBe("1.01");
                expect(json.title).toBe("Forsentkomming");
                expect(json.amount).toBe(2);
            },
            500_000,
        );

        integrationTest(
            "successfully creates a law as fines admin",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-admin-group",
                });
                await ctx.db
                    .update(schema.group)
                    .set({ finesAdminId: user.id })
                    .where(eq(schema.group.slug, group.slug));

                const response = await client.api.groups[
                    ":groupSlug"
                ].laws.$post({
                    param: { groupSlug: group.slug },
                    json: { paragraph: 2, title: "Glemt utstyr" },
                });

                expect(response.status).toBe(201);
                const json = await response.json();
                expect(json.paragraph).toBe("2.00");
                expect(json.amount).toBe(1);
                expect(json.description).toBe("");
            },
            500_000,
        );

        integrationTest(
            "regular member cannot create a law",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-member-group",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].laws.$post({
                    param: { groupSlug: group.slug },
                    json: { paragraph: 1, title: "Skal feile" },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );
    });

    describe("list laws", () => {
        integrationTest(
            "group member can list laws ordered by paragraph",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-list-group",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });
                await ctx.db.insert(schema.groupLaw).values([
                    {
                        groupSlug: group.slug,
                        paragraph: "2.10",
                        title: "Andre",
                    },
                    {
                        groupSlug: group.slug,
                        paragraph: "1.00",
                        title: "Første",
                    },
                ]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].laws.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json).toHaveLength(2);
                expect(json[0]?.title).toBe("Første");
                expect(json[1]?.title).toBe("Andre");
            },
            500_000,
        );

        integrationTest(
            "non-member cannot list laws",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-private-group",
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].laws.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );
    });

    describe("update and delete law", () => {
        integrationTest(
            "leader can update and delete a law",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-edit-group",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                const [law] = await ctx.db
                    .insert(schema.groupLaw)
                    .values({
                        groupSlug: group.slug,
                        paragraph: "1.00",
                        title: "Original",
                    })
                    .returning();

                const updateResponse = await client.api.groups[
                    ":groupSlug"
                ].laws[":lawId"].$patch({
                    param: { groupSlug: group.slug, lawId: law!.id },
                    json: { title: "Oppdatert", amount: 3 },
                });

                expect(updateResponse.status).toBe(200);
                const updated = await updateResponse.json();
                expect(updated.title).toBe("Oppdatert");
                expect(updated.amount).toBe(3);

                const deleteResponse = await client.api.groups[
                    ":groupSlug"
                ].laws[":lawId"].$delete({
                    param: { groupSlug: group.slug, lawId: law!.id },
                });

                expect(deleteResponse.status).toBe(204);

                const remaining = await ctx.db
                    .select()
                    .from(schema.groupLaw)
                    .where(eq(schema.groupLaw.groupSlug, group.slug));
                expect(remaining).toHaveLength(0);
            },
            500_000,
        );

        integrationTest(
            "member cannot delete a law",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "laws-del-group",
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });
                const [law] = await ctx.db
                    .insert(schema.groupLaw)
                    .values({
                        groupSlug: group.slug,
                        paragraph: "1.00",
                        title: "Beskyttet",
                    })
                    .returning();

                const response = await client.api.groups[":groupSlug"].laws[
                    ":lawId"
                ].$delete({
                    param: { groupSlug: group.slug, lawId: law!.id },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );
    });
});
