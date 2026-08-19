import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { removeUserFromGroup } from "~/lib/group";
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
                await ctx.db.insert(schema.groupMembership).values({
                    userId: targetUser.user.id,
                    groupSlug: group.slug,
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
            "accepts a fine with an amount of 0",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "fines-zero-group",
                    finesActivated: true,
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const targetUser = await ctx.auth.api.createUser({
                    body: {
                        email: "zero-target@test.com",
                        name: "Zero Target",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: targetUser.user.id,
                    groupSlug: group.slug,
                });

                // 0 bøter er en gyldig registrering — en advarsel som ikke
                // teller i summene.
                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: targetUser.user.id,
                        groupSlug: group.slug,
                        reason: "Advarsel",
                        amount: 0,
                    },
                });

                expect(response.status).toBe(201);
                const json = await response.json();
                expect(json.amount).toBe(0);
            },
            500_000,
        );

        integrationTest(
            "successfully creates a fine as a plain member of the group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });

                const targetUser = await ctx.auth.api.createUser({
                    body: {
                        email: "target2@test.com",
                        name: "Target User 2",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: targetUser.user.id,
                    groupSlug: group.slug,
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
            "fails to create fine when the caller is not in the group",
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });

                const targetUser = await ctx.auth.api.createUser({
                    body: {
                        email: "defense@test.com",
                        name: "Defense User",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: targetUser.user.id,
                    groupSlug: group.slug,
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

        integrationTest(
            "refuses an outsider who is not a member of the group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "outsider-cannot-fine",
                    finesActivated: true,
                });
                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "outsider-victim@test.com",
                        name: "Outsider Victim",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: target.user.id,
                    groupSlug: group.slug,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "Utenforstående",
                        amount: 1,
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "refuses to fine someone who is not in the group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "members-only-fines",
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });

                const outsider = await ctx.auth.api.createUser({
                    body: {
                        email: "outsider-fine@test.com",
                        name: "Outsider",
                        password: "test123!",
                    },
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: outsider.user.id,
                        groupSlug: group.slug,
                        reason: "Ikke medlem",
                        amount: 1,
                    },
                });

                expect(response.status).toBe(400);
            },
            500_000,
        );

        integrationTest(
            "refuses a body that points at another group than the URL",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "slug-in-url",
                    finesActivated: true,
                });
                const otherGroup = await ctx.utils.createTestGroup({
                    slug: "slug-in-body",
                    finesActivated: true,
                });
                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "slug-mismatch@test.com",
                        name: "Slug Mismatch",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: target.user.id,
                    groupSlug: otherGroup.slug,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: target.user.id,
                        groupSlug: otherGroup.slug,
                        reason: "Feil gruppe",
                        amount: 1,
                    },
                });

                expect(response.status).toBe(400);
            },
            500_000,
        );
    });

    describe("delete fine", () => {
        integrationTest(
            "successfully deletes a fine as the group's leader",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
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
            "fails to delete fine as a plain member",
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Bøter følger medlemskap: leseren må være med i gruppen.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
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
            "fails to get fine as a non-member with no part in it",
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
                // Boten er gitt av en annen: leseren er verken den bøtelagte
                // eller den som ga boten, og har da ikke noe der å gjøre.
                const giver = await ctx.auth.api.createUser({
                    body: {
                        email: "giver2@test.com",
                        name: "Giver User 2",
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
                        createdByUserId: giver.user.id,
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

                const group = await ctx.utils.createTestGroup({
                    slug: "fines-list-group",
                    finesActivated: true,
                });
                // Bøter følger medlemskap: leseren må være med i gruppen.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
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
                    query: {},
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(json.totalCount).toBe(2);
                expect(json.fines.length).toBe(2);
                expect(json.nextPage).toBeNull();

                // Filtrene brukes til å plukke ut én status og én person.
                const pending = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: { status: "pending" },
                });
                const pendingJson = await pending.json();
                expect(pendingJson.totalCount).toBe(1);
                expect(pendingJson.fines[0]?.reason).toBe("Fine 1");

                const byUser = await client.api.groups[":groupSlug"].fines.$get(
                    {
                        param: { groupSlug: group.slug },
                        query: { userId: targetUser2.user.id },
                    },
                );
                const byUserJson = await byUser.json();
                expect(byUserJson.totalCount).toBe(1);
                expect(byUserJson.fines[0]?.reason).toBe("Fine 2");

                // En side om gangen: siden det finnes to bøter skal side 0
                // gi én rad og peke videre til side 1.
                const firstPage = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: { pageSize: "1", page: "0" },
                });
                const firstPageJson = await firstPage.json();
                expect(firstPageJson.fines.length).toBe(1);
                expect(firstPageJson.pages).toBe(2);
                expect(firstPageJson.nextPage).toBe(1);

                const lastPage = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: { pageSize: "1", page: "1" },
                });
                const lastPageJson = await lastPage.json();
                expect(lastPageJson.fines.length).toBe(1);
                expect(lastPageJson.nextPage).toBeNull();
            },
            500_000,
        );

        integrationTest(
            "returns empty array for group with no fines",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Bøter følger medlemskap: leseren må være med i gruppen.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });

                expect(response.status).toBe(200);

                const json = await response.json();
                expect(json.totalCount).toBe(0);
                expect(json.fines.length).toBe(0);
                expect(json.nextPage).toBeNull();
            },
            500_000,
        );

        integrationTest(
            "hides fines when the group has the fine system switched off",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "fines-off",
                    finesActivated: false,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "keeps a removed member's own fines readable, given and received",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "fines-removed-member",
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });

                const other = await ctx.auth.api.createUser({
                    body: {
                        email: "removed-other@test.com",
                        name: "Removed Other",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: other.user.id,
                    groupSlug: group.slug,
                });

                const [received] = await ctx.db
                    .insert(schema.fine)
                    .values({
                        userId: user.id,
                        groupSlug: group.slug,
                        reason: "Boten jeg fikk",
                        amount: 50,
                        createdByUserId: other.user.id,
                    })
                    .returning();
                await ctx.db.insert(schema.fine).values([
                    {
                        userId: other.user.id,
                        groupSlug: group.slug,
                        reason: "Boten jeg ga",
                        amount: 60,
                        createdByUserId: user.id,
                    },
                    // Denne har hen ingen del i, og skal ikke følge med ut.
                    {
                        userId: other.user.id,
                        groupSlug: group.slug,
                        reason: "Gruppens egen sak",
                        amount: 70,
                        createdByUserId: other.user.id,
                    },
                ]);

                await removeUserFromGroup(ctx, user.id, group.slug);

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.totalCount).toBe(2);
                expect(json.fines.map((f) => f.reason).sort()).toEqual([
                    "Boten jeg fikk",
                    "Boten jeg ga",
                ]);

                // Og den enkelte boten er fortsatt mulig å slå opp.
                if (!received) {
                    throw new Error("Failed to create fine");
                }
                const single = await client.api.groups[":groupSlug"].fines[
                    ":fineId"
                ].$get({
                    param: { groupSlug: group.slug, fineId: received.id },
                });

                expect(single.status).toBe(200);
                expect((await single.json()).reason).toBe("Boten jeg fikk");
            },
            500_000,
        );

        integrationTest(
            "hides the group's fines from a non-member with none of their own",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });

                const member = await ctx.auth.api.createUser({
                    body: {
                        email: "list-outsider-member@test.com",
                        name: "List Outsider Member",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.user.id,
                    groupSlug: group.slug,
                });
                await ctx.db.insert(schema.fine).values({
                    userId: member.user.id,
                    groupSlug: group.slug,
                    reason: "Ikke utenforståendes bord",
                    amount: 50,
                    createdByUserId: member.user.id,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });

                // Botlista er gruppens; den som står utenfor ser bare sine
                // egne bøter, og har ingen her.
                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.fines).toHaveLength(0);
                expect(json.totalCount).toBe(0);
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
                ].fines.$get({
                    param: { groupSlug: "non-existent" },
                    query: {},
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
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
            "fails to update fine as a plain member",
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

                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
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

        integrationTest(
            "only the fined member may write a defense, empty string included",
            async ({ ctx }) => {
                const owner = await ctx.utils.createTestUser();
                const ownerClient = await ctx.utils.clientForUser(owner);

                const group = await ctx.utils.createTestGroup({
                    slug: "defense-owner",
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: owner.id,
                    groupSlug: group.slug,
                });

                const [fine] = await ctx.db
                    .insert(schema.fine)
                    .values({
                        userId: owner.id,
                        groupSlug: group.slug,
                        reason: "Har et forsvar",
                        amount: 1,
                        status: "pending",
                        defense: "Opprinnelig forsvar",
                    })
                    .returning();

                const mine = await ownerClient.api.groups[":groupSlug"].fines[
                    ":fineId"
                ].$patch({
                    param: { groupSlug: group.slug, fineId: fine!.id },
                    json: { defense: "Jeg var syk" },
                });
                expect(mine.status).toBe(200);

                // En annen bruker skal ikke kunne tømme forsvaret. Tidligere
                // slapp `defense: ""` gjennom fordi sjekken var på truthiness.
                const other = await ctx.utils.createTestUser();
                const otherClient = await ctx.utils.clientForUser(other);
                await ctx.db.insert(schema.groupMembership).values({
                    userId: other.id,
                    groupSlug: group.slug,
                });

                const wiped = await otherClient.api.groups[":groupSlug"].fines[
                    ":fineId"
                ].$patch({
                    param: { groupSlug: group.slug, fineId: fine!.id },
                    json: { defense: "" },
                });
                expect(wiped.status).toBe(403);

                const [after] = await ctx.db
                    .select()
                    .from(schema.fine)
                    .where(eq(schema.fine.id, fine!.id));
                expect(after?.defense).toBe("Jeg var syk");
            },
            500_000,
        );
    });

    describe("fine ↔ paragraph", () => {
        integrationTest(
            "carries the cited paragraph through create, list and get",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "law-linked-fines",
                    finesActivated: true,
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
                        paragraph: "3.10",
                        title: "Møtte ikke opp",
                        amount: 2,
                    })
                    .returning();

                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "law-fine-target@test.com",
                        name: "Law Target",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: target.user.id,
                    groupSlug: group.slug,
                });

                const created = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "Kom ikke på møtet",
                        amount: 2,
                        lawId: law!.id,
                    },
                });

                expect(created.status).toBe(201);
                const createdJson = await created.json();
                expect(createdJson.lawId).toBe(law!.id);
                expect(createdJson.law?.paragraph).toBe("3.10");
                expect(createdJson.law?.title).toBe("Møtte ikke opp");

                const list = await client.api.groups[":groupSlug"].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });
                const listJson = await list.json();
                expect(listJson.fines[0]?.law?.title).toBe("Møtte ikke opp");

                const single = await client.api.groups[":groupSlug"].fines[
                    ":fineId"
                ].$get({
                    param: {
                        groupSlug: group.slug,
                        fineId: createdJson.id,
                    },
                });
                const singleJson = await single.json();
                expect(singleJson.law?.paragraph).toBe("3.10");
            },
            500_000,
        );

        integrationTest(
            "rejects a paragraph from another group's lovverk",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "own-lovverk",
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const otherGroup = await ctx.utils.createTestGroup({
                    slug: "other-lovverk",
                    finesActivated: true,
                });
                const [foreignLaw] = await ctx.db
                    .insert(schema.groupLaw)
                    .values({
                        groupSlug: otherGroup.slug,
                        paragraph: "1.00",
                        title: "Fremmed paragraf",
                    })
                    .returning();

                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "foreign-law-target@test.com",
                        name: "Foreign Target",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: target.user.id,
                    groupSlug: group.slug,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "Feil lovverk",
                        amount: 1,
                        lawId: foreignLaw!.id,
                    },
                });

                expect(response.status).toBe(404);
            },
            500_000,
        );

        integrationTest(
            "keeps the fine when the paragraph it cites is deleted",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "law-deleted",
                    finesActivated: true,
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
                        paragraph: "4.00",
                        title: "Skal slettes",
                    })
                    .returning();

                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "law-deleted-target@test.com",
                        name: "Deleted Law Target",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: target.user.id,
                    groupSlug: group.slug,
                });

                const created = await client.api.groups[
                    ":groupSlug"
                ].fines.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "Boten overlever lovverket",
                        amount: 1,
                        lawId: law!.id,
                    },
                });
                const createdJson = await created.json();

                // Lovverk redigeres etter at bøter er gitt. Boten skal bli
                // stående — bare koblingen forsvinner.
                await ctx.db
                    .delete(schema.groupLaw)
                    .where(eq(schema.groupLaw.id, law!.id));

                const single = await client.api.groups[":groupSlug"].fines[
                    ":fineId"
                ].$get({
                    param: { groupSlug: group.slug, fineId: createdJson.id },
                });

                expect(single.status).toBe(200);
                const singleJson = await single.json();
                expect(singleJson.law).toBeNull();
                expect(singleJson.lawId).toBeNull();
                expect(singleJson.reason).toBe("Boten overlever lovverket");
            },
            500_000,
        );
    });

    describe("statistics", () => {
        integrationTest(
            "sums each settlement stage and leaves rejected fines out",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "fine-stats",
                    finesActivated: true,
                });
                // Bøter følger medlemskap: leseren må være med i gruppen.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });
                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "stats-target@test.com",
                        name: "Stats Target",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: target.user.id,
                    groupSlug: group.slug,
                });

                await ctx.db.insert(schema.fine).values([
                    {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "a",
                        amount: 3,
                        status: "pending",
                    },
                    {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "b",
                        amount: 4,
                        status: "approved",
                    },
                    {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "c",
                        amount: 5,
                        status: "paid",
                    },
                    {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "d",
                        amount: 99,
                        status: "rejected",
                    },
                ]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.statistics.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.notApproved).toBe(3);
                expect(json.approvedNotPaid).toBe(4);
                expect(json.paid).toBe(5);
            },
            500_000,
        );

        integrationTest(
            "leaves a removed member's unpaid fines out, but keeps their paid ones",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "fine-stats-removed",
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                });

                const former = await ctx.auth.api.createUser({
                    body: {
                        email: "stats-former@test.com",
                        name: "Stats Former",
                        password: "test123!",
                    },
                });

                // Ble med, fikk bøter, og ble så fjernet fra gruppen.
                await ctx.db.insert(schema.groupMembership).values({
                    userId: former.user.id,
                    groupSlug: group.slug,
                });
                await ctx.db.insert(schema.fine).values([
                    {
                        userId: former.user.id,
                        groupSlug: group.slug,
                        reason: "ubetalt ved exit",
                        amount: 7,
                        status: "pending",
                    },
                    {
                        userId: former.user.id,
                        groupSlug: group.slug,
                        reason: "godkjent, men ubetalt",
                        amount: 11,
                        status: "approved",
                    },
                    {
                        userId: former.user.id,
                        groupSlug: group.slug,
                        reason: "gjort opp for",
                        amount: 13,
                        status: "paid",
                    },
                ]);
                await removeUserFromGroup(ctx, former.user.id, group.slug);

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.statistics.$get({
                    param: { groupSlug: group.slug },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.notApproved).toBe(0);
                expect(json.approvedNotPaid).toBe(0);
                expect(json.paid).toBe(13);
            },
            500_000,
        );
    });

    describe("fines per member", () => {
        integrationTest(
            "sums only the active fines per member, and honours the status filter",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(user);

                const group = await ctx.utils.createTestGroup({
                    slug: "fines-per-member",
                    finesActivated: true,
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const fined = await ctx.auth.api.createUser({
                    body: {
                        email: "per-member-fined@test.com",
                        name: "Aaa Fined",
                        password: "test123!",
                    },
                });
                const clean = await ctx.auth.api.createUser({
                    body: {
                        email: "per-member-clean@test.com",
                        name: "Bbb Clean",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values([
                    { userId: fined.user.id, groupSlug: group.slug },
                    { userId: clean.user.id, groupSlug: group.slug },
                ]);

                // Flere bøter på samme person: tallet skal være summen av
                // beløpene, ikke antall rader — og bare de aktive bøtene
                // (pending + approved) teller. Betalte og avviste er gjort opp.
                await ctx.db.insert(schema.fine).values([
                    {
                        userId: fined.user.id,
                        groupSlug: group.slug,
                        reason: "a",
                        amount: 2,
                        status: "pending",
                    },
                    {
                        userId: fined.user.id,
                        groupSlug: group.slug,
                        reason: "b",
                        amount: 5,
                        status: "paid",
                    },
                    {
                        userId: fined.user.id,
                        groupSlug: group.slug,
                        reason: "c",
                        amount: 3,
                        status: "approved",
                    },
                    {
                        userId: fined.user.id,
                        groupSlug: group.slug,
                        reason: "d",
                        amount: 9,
                        status: "rejected",
                    },
                ]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.users.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                // Lederen teller også som medlem.
                expect(json.totalCount).toBe(3);

                const finedRow = json.users.find((u) => u.id === fined.user.id);
                expect(finedRow?.finesAmount).toBe(5);
                expect(finedRow?.finesCount).toBe(2);

                // Medlemmer uten bøter skal stå i lista med 0, ikke mangle.
                const cleanRow = json.users.find((u) => u.id === clean.user.id);
                expect(cleanRow?.finesAmount).toBe(0);
                expect(cleanRow?.finesCount).toBe(0);

                const paidOnly = await client.api.groups[
                    ":groupSlug"
                ].fines.users.$get({
                    param: { groupSlug: group.slug },
                    query: { status: "paid" },
                });
                const paidJson = await paidOnly.json();
                const paidRow = paidJson.users.find(
                    (u) => u.id === fined.user.id,
                );
                expect(paidRow?.finesAmount).toBe(5);
                expect(paidRow?.finesCount).toBe(1);
            },
            500_000,
        );
    });

    describe("batch update", () => {
        integrationTest(
            "settles every fine a member has, and refuses callers who do not lead the group",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const adminClient = await ctx.utils.clientForUser(admin);
                const group = await ctx.utils.createTestGroup({
                    slug: "fines-batch",
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
                await ctx.db.insert(schema.groupMembership).values({
                    userId: admin.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "batch-target@test.com",
                        name: "Batch Target",
                        password: "test123!",
                    },
                });

                await ctx.db.insert(schema.fine).values([
                    {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "a",
                        amount: 1,
                        status: "pending",
                    },
                    {
                        userId: target.user.id,
                        groupSlug: group.slug,
                        reason: "b",
                        amount: 1,
                        status: "pending",
                    },
                ]);

                const response = await adminClient.api.groups[
                    ":groupSlug"
                ].fines.users[":userId"].batch.$patch({
                    param: { groupSlug: group.slug, userId: target.user.id },
                    json: { status: "approved" },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.updated).toBe(2);

                const rows = await ctx.db
                    .select()
                    .from(schema.fine)
                    .where(eq(schema.fine.groupSlug, group.slug));
                expect(rows.every((row) => row.status === "approved")).toBe(
                    true,
                );
                expect(rows.every((row) => row.approvedAt !== null)).toBe(true);

                // Et vanlig medlem skal ikke kunne gjøre opp andres bøter.
                const outsider = await ctx.utils.createTestUser();
                const outsiderClient = await ctx.utils.clientForUser(outsider);
                const forbidden = await outsiderClient.api.groups[
                    ":groupSlug"
                ].fines.users[":userId"].batch.$patch({
                    param: { groupSlug: group.slug, userId: target.user.id },
                    json: { status: "paid" },
                });
                expect(forbidden.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "rejects a batch that names a fine from another group",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                const group = await ctx.utils.createTestGroup({
                    slug: "fines-batch-own",
                    finesActivated: true,
                });
                // Settling fines is the botsjef's and the leader's job
                await ctx.db.insert(schema.groupMembership).values({
                    userId: admin.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                const otherGroup = await ctx.utils.createTestGroup({
                    slug: "fines-batch-other",
                    finesActivated: true,
                });
                const target = await ctx.auth.api.createUser({
                    body: {
                        email: "batch-foreign@test.com",
                        name: "Batch Foreign",
                        password: "test123!",
                    },
                });

                const [foreignFine] = await ctx.db
                    .insert(schema.fine)
                    .values({
                        userId: target.user.id,
                        groupSlug: otherGroup.slug,
                        reason: "fremmed",
                        amount: 1,
                        status: "pending",
                    })
                    .returning();

                const response = await client.api.groups[
                    ":groupSlug"
                ].fines.batch.$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        fineIds: [foreignFine!.id],
                        status: "approved",
                    },
                });

                expect(response.status).toBe(400);

                const [unchanged] = await ctx.db
                    .select()
                    .from(schema.fine)
                    .where(eq(schema.fine.id, foreignFine!.id));
                expect(unchanged?.status).toBe("pending");
            },
            500_000,
        );
    });
});
