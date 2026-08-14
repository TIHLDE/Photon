import { syncBaselineRoles } from "@photon/auth/feide";
import { getUserPermissions } from "@photon/auth/rbac";
import { createTestingRole, getUserRoles } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    addUserToGroup,
    removeUserFromGroup,
    updateGroupMemberRole,
} from "~/lib/group";
import { integrationTest } from "~/test/config/integration";

/**
 * Tests for group positions (verv/titler), the two-level guardrails,
 * leader-role auto-assignment and baseline role sync.
 */

describe("group positions", () => {
    describe("create position guardrails", () => {
        integrationTest(
            "leader can create a group-scoped position with permissions they hold",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                await ctx.utils.giveUserPermissions(leader, ["news:manage"]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Økonomiansvarlig",
                        permissions: ["news:manage"],
                        scope: "group",
                    },
                });

                expect(response.status).toBe(201);
                const json = await response.json();
                expect(json.name).toBe("Økonomiansvarlig");
                expect(json.scope).toBe("group");
            },
            500_000,
        );

        integrationTest(
            "leader cannot grant permissions they do not hold",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Sneaky",
                        permissions: ["events:payments:refund"],
                        scope: "group",
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "leader cannot create a global-scope position",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                await ctx.utils.giveUserPermissions(leader, ["news:manage"]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Global Sneaky",
                        permissions: ["news:manage"],
                        scope: "global",
                    },
                });

                expect(response.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "roles:create holder can create a global position with held permissions",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                const group = await ctx.utils.createTestGroup();

                await ctx.utils.giveUserPermissions(admin, [
                    "roles:create",
                    "events:payments:refund",
                ]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Sosialminister",
                        permissions: ["events:payments:refund"],
                        scope: "global",
                    },
                });

                expect(response.status).toBe(201);
                const json = await response.json();
                expect(json.scope).toBe("global");
            },
            500_000,
        );
    });

    describe("assignment and permission resolution", () => {
        integrationTest(
            "assigned holder receives group-scoped permissions",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const member = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

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
                await ctx.utils.giveUserPermissions(leader, ["news:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["news:manage"],
                        scope: "group",
                    },
                });
                expect(createResponse.status).toBe(201);
                const position = await createResponse.json();

                const assignResponse = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: member.id },
                });
                expect(assignResponse.status).toBe(200);

                const permissions = await getUserPermissions(ctx, member.id);
                expect(permissions).toContain(
                    `news:manage@group:${group.slug}`,
                );

                // Unassign removes the permission again
                const unassignResponse = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: group.slug,
                        positionId: position.id,
                        userId: member.id,
                    },
                });
                expect(unassignResponse.status).toBe(200);
                const after = await getUserPermissions(ctx, member.id);
                expect(after).not.toContain(`news:manage@group:${group.slug}`);
            },
            500_000,
        );

        integrationTest(
            "a position can only have one holder — second assignment is rejected",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const first = await ctx.utils.createTestUser();
                const second = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values([
                    {
                        userId: leader.id,
                        groupSlug: group.slug,
                        role: "leader",
                    },
                    { userId: first.id, groupSlug: group.slug, role: "member" },
                    {
                        userId: second.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                ]);
                await ctx.utils.giveUserPermissions(leader, ["news:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Økonomiansvarlig",
                        permissions: ["news:manage"],
                        scope: "group",
                    },
                });
                const position = await createResponse.json();

                const assignFirst = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: first.id },
                });
                expect(assignFirst.status).toBe(200);

                // Same user again is idempotent
                const assignAgain = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: first.id },
                });
                expect(assignAgain.status).toBe(200);

                // A different user is rejected while the position is held
                const assignSecond = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: second.id },
                });
                expect(assignSecond.status).toBe(409);

                // Instead, a second identically-named position can be created
                // and assigned — "two økonomiansvarlige" = two positions.
                const createSecond = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Økonomiansvarlig",
                        permissions: ["news:manage"],
                        scope: "group",
                    },
                });
                expect(createSecond.status).toBe(201);
                const secondPosition = await createSecond.json();

                const assignToSecond = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: {
                        groupSlug: group.slug,
                        positionId: secondPosition.id,
                    },
                    json: { userId: second.id },
                });
                expect(assignToSecond.status).toBe(200);
            },
            500_000,
        );

        integrationTest(
            "cannot assign a position to a non-member",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const outsider = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });
                await ctx.utils.giveUserPermissions(leader, ["news:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["news:manage"],
                        scope: "group",
                    },
                });
                const position = await createResponse.json();

                const assignResponse = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: outsider.id },
                });
                expect(assignResponse.status).toBe(400);
            },
            500_000,
        );

        integrationTest(
            "root title can only be assigned by a root holder",
            async ({ ctx }) => {
                const auMember = await ctx.utils.createTestUser();
                const rootUser = await ctx.utils.createTestUser();
                const target = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values([
                    {
                        userId: target.id,
                        groupSlug: group.slug,
                        role: "member",
                    },
                ]);
                await ctx.utils.giveUserPermissions(auMember, [
                    "roles:create",
                    "roles:assign",
                ]);
                await ctx.utils.giveUserPermissions(rootUser, ["root"]);

                // Root user creates the root-granting title
                const rootClient = await ctx.utils.clientForUser(rootUser);
                const createResponse = await rootClient.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Teknologiminister",
                        permissions: ["root"],
                        scope: "global",
                    },
                });
                expect(createResponse.status).toBe(201);
                const position = await createResponse.json();

                // AU member (no root) cannot assign it
                const auClient = await ctx.utils.clientForUser(auMember);
                const forbidden = await auClient.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: target.id },
                });
                expect(forbidden.status).toBe(403);

                // Root holder can
                const allowed = await rootClient.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: target.id },
                });
                expect(allowed.status).toBe(200);

                const permissions = await getUserPermissions(ctx, target.id);
                expect(permissions).toContain("root");
            },
            500_000,
        );

        integrationTest(
            "leaving the group removes held positions",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const member = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

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
                await ctx.utils.giveUserPermissions(leader, ["news:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["news:manage"],
                        scope: "group",
                    },
                });
                const position = await createResponse.json();

                await client.api.groups[":groupSlug"].positions[
                    ":positionId"
                ].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: member.id },
                });

                await removeUserFromGroup(ctx, member.id, group.slug);

                const holders = await ctx.db
                    .select()
                    .from(schema.groupPositionHolder)
                    .where(eq(schema.groupPositionHolder.userId, member.id));
                expect(holders).toHaveLength(0);
            },
            500_000,
        );
    });

    describe("HS auto-membership for subgroup leaders", () => {
        integrationTest(
            "new subgroup leader joins HS and gets an auto-created leder-verv",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                await ctx.utils.createTestGroup({
                    slug: "hs",
                    name: "Hovedstyret",
                    type: "board",
                });
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Testgruppen",
                });

                await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

                // In HS now
                const hsMembership =
                    await ctx.db.query.groupMembership.findFirst({
                        where: and(
                            eq(schema.groupMembership.userId, leader.id),
                            eq(schema.groupMembership.groupSlug, "hs"),
                        ),
                    });
                expect(hsMembership).toBeDefined();

                // Holds the auto-created linked verv in hs
                const [position] = await ctx.db
                    .select()
                    .from(schema.groupPosition)
                    .where(
                        eq(schema.groupPosition.linkedGroupSlug, subgroup.slug),
                    );
                expect(position).toBeDefined();
                expect(position?.groupSlug).toBe("hs");
                expect(position?.name).toBe("Leder av Testgruppen");

                const [holder] = await ctx.db
                    .select()
                    .from(schema.groupPositionHolder)
                    .where(
                        eq(schema.groupPositionHolder.positionId, position!.id),
                    );
                expect(holder?.userId).toBe(leader.id);
            },
            500_000,
        );

        integrationTest(
            "linked leader-verv cannot be assigned or unassigned manually",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const outsider = await ctx.utils.createTestUser();
                // Actor holds root — so a 409 proves the guard blocks the
                // linked verv, not a missing permission.
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                const client = await ctx.utils.clientForUser(admin);

                await ctx.utils.createTestGroup({
                    slug: "hs",
                    name: "Hovedstyret",
                    type: "board",
                });
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Låstgruppen",
                });

                // Becoming leader auto-creates the linked verv in HS.
                await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

                const [position] = await ctx.db
                    .select()
                    .from(schema.groupPosition)
                    .where(
                        eq(schema.groupPosition.linkedGroupSlug, subgroup.slug),
                    );
                expect(position).toBeDefined();

                // Manual assignment to someone else is rejected.
                const assignResponse = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: "hs", positionId: position!.id },
                    json: { userId: outsider.id },
                });
                expect(assignResponse.status).toBe(409);

                // Manual unassignment of the auto-assigned leader is rejected.
                const unassignResponse = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: "hs",
                        positionId: position!.id,
                        userId: leader.id,
                    },
                });
                expect(unassignResponse.status).toBe(409);

                // The verv still belongs to the group leader.
                const [holder] = await ctx.db
                    .select()
                    .from(schema.groupPositionHolder)
                    .where(
                        eq(schema.groupPositionHolder.positionId, position!.id),
                    );
                expect(holder?.userId).toBe(leader.id);
            },
            500_000,
        );

        integrationTest(
            "leadership change moves the verv and prunes the old leader from HS",
            async ({ ctx }) => {
                const oldLeader = await ctx.utils.createTestUser();
                const newLeader = await ctx.utils.createTestUser();
                await ctx.utils.createTestGroup({
                    slug: "hs",
                    name: "Hovedstyret",
                    type: "board",
                });
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Skiftegruppen",
                });

                await addUserToGroup(
                    ctx,
                    oldLeader.id,
                    subgroup.slug,
                    "leader",
                );
                await addUserToGroup(
                    ctx,
                    newLeader.id,
                    subgroup.slug,
                    "member",
                );

                // Handover: old leader demoted, new promoted
                await updateGroupMemberRole(
                    ctx,
                    oldLeader.id,
                    subgroup.slug,
                    "member",
                );
                await updateGroupMemberRole(
                    ctx,
                    newLeader.id,
                    subgroup.slug,
                    "leader",
                );

                // Verv follows the leadership
                const [position] = await ctx.db
                    .select()
                    .from(schema.groupPosition)
                    .where(
                        eq(schema.groupPosition.linkedGroupSlug, subgroup.slug),
                    );
                const [holder] = await ctx.db
                    .select()
                    .from(schema.groupPositionHolder)
                    .where(
                        eq(schema.groupPositionHolder.positionId, position!.id),
                    );
                expect(holder?.userId).toBe(newLeader.id);

                // Old leader is out of HS, new leader is in
                const oldHs = await ctx.db.query.groupMembership.findFirst({
                    where: and(
                        eq(schema.groupMembership.userId, oldLeader.id),
                        eq(schema.groupMembership.groupSlug, "hs"),
                    ),
                });
                expect(oldHs).toBeUndefined();
                const newHs = await ctx.db.query.groupMembership.findFirst({
                    where: and(
                        eq(schema.groupMembership.userId, newLeader.id),
                        eq(schema.groupMembership.groupSlug, "hs"),
                    ),
                });
                expect(newHs).toBeDefined();
            },
            500_000,
        );

        integrationTest(
            "ex-leader stays in HS while holding another HS verv",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                await ctx.utils.createTestGroup({
                    slug: "hs",
                    name: "Hovedstyret",
                    type: "board",
                });
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Dobbeltvervgruppen",
                });

                await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

                // Also holds an AU-style verv in hs
                const [auPosition] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({
                        groupSlug: "hs",
                        name: "Visepresident",
                        permissions: [],
                        scope: "global",
                    })
                    .returning();
                await ctx.db.insert(schema.groupPositionHolder).values({
                    positionId: auPosition!.id,
                    userId: leader.id,
                });

                await updateGroupMemberRole(
                    ctx,
                    leader.id,
                    subgroup.slug,
                    "member",
                );

                // Still in HS — the AU verv warrants the seat
                const hsMembership =
                    await ctx.db.query.groupMembership.findFirst({
                        where: and(
                            eq(schema.groupMembership.userId, leader.id),
                            eq(schema.groupMembership.groupSlug, "hs"),
                        ),
                    });
                expect(hsMembership).toBeDefined();
            },
            500_000,
        );

        integrationTest(
            "linked minister title is reused instead of creating a duplicate verv",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                await ctx.utils.createTestGroup({
                    slug: "hs",
                    name: "Hovedstyret",
                    type: "board",
                });
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Index",
                });

                // Pre-linked minister title (like the seed does)
                const [minister] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({
                        groupSlug: "hs",
                        name: "Teknologiminister",
                        permissions: [],
                        scope: "global",
                        linkedGroupSlug: subgroup.slug,
                    })
                    .returning();

                await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

                // No duplicate "Leder av Index" — the minister title was used
                const linked = await ctx.db
                    .select()
                    .from(schema.groupPosition)
                    .where(
                        eq(schema.groupPosition.linkedGroupSlug, subgroup.slug),
                    );
                expect(linked).toHaveLength(1);

                const [holder] = await ctx.db
                    .select()
                    .from(schema.groupPositionHolder)
                    .where(
                        eq(schema.groupPositionHolder.positionId, minister!.id),
                    );
                expect(holder?.userId).toBe(leader.id);
            },
            500_000,
        );
    });

    describe("AU verv follow the seat in HS", () => {
        const HS = { slug: "hs", name: "Hovedstyret", type: "board" };

        integrationTest(
            "losing an AU verv takes the HS seat with it",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                await ctx.utils.createTestGroup(HS);
                const client = await ctx.utils.clientForUser(admin);
                const finansminister = await ctx.utils.createTestUser();

                await addUserToGroup(ctx, finansminister.id, "hs", "member");
                const [position] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({ groupSlug: "hs", name: "Finansminister" })
                    .returning();
                await ctx.db.insert(schema.groupPositionHolder).values({
                    positionId: position!.id,
                    userId: finansminister.id,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: "hs",
                        positionId: position!.id,
                        userId: finansminister.id,
                    },
                });

                expect(response.status).toBe(200);

                const membership = await ctx.db.query.groupMembership.findFirst(
                    {
                        where: and(
                            eq(
                                schema.groupMembership.userId,
                                finansminister.id,
                            ),
                            eq(schema.groupMembership.groupSlug, "hs"),
                        ),
                    },
                );
                expect(membership).toBeUndefined();
            },
            500_000,
        );

        integrationTest(
            "a subgroup leader keeps the HS seat when an AU verv is taken away",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                await ctx.utils.createTestGroup(HS);
                const client = await ctx.utils.clientForUser(admin);
                const minister = await ctx.utils.createTestUser();
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Undergruppen",
                });

                // Lederskapet i undergruppen tar hen inn i HS uansett.
                await addUserToGroup(ctx, minister.id, subgroup.slug, "leader");
                const [position] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({ groupSlug: "hs", name: "Visepresident" })
                    .returning();
                await ctx.db.insert(schema.groupPositionHolder).values({
                    positionId: position!.id,
                    userId: minister.id,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: "hs",
                        positionId: position!.id,
                        userId: minister.id,
                    },
                });

                expect(response.status).toBe(200);

                const membership = await ctx.db.query.groupMembership.findFirst(
                    {
                        where: and(
                            eq(schema.groupMembership.userId, minister.id),
                            eq(schema.groupMembership.groupSlug, "hs"),
                        ),
                    },
                );
                expect(membership).toBeDefined();
            },
            500_000,
        );

        integrationTest(
            "deleting an HS verv takes its holder's seat with it",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                await ctx.utils.createTestGroup(HS);
                const client = await ctx.utils.clientForUser(admin);
                const visepresident = await ctx.utils.createTestUser();

                await addUserToGroup(ctx, visepresident.id, "hs", "member");
                const [position] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({ groupSlug: "hs", name: "Visepresident" })
                    .returning();
                await ctx.db.insert(schema.groupPositionHolder).values({
                    positionId: position!.id,
                    userId: visepresident.id,
                });

                // Vervet legges ned, ikke bare fratas.
                const response = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].$delete({
                    param: { groupSlug: "hs", positionId: position!.id },
                });

                expect(response.status).toBe(200);

                const membership = await ctx.db.query.groupMembership.findFirst(
                    {
                        where: and(
                            eq(schema.groupMembership.userId, visepresident.id),
                            eq(schema.groupMembership.groupSlug, "hs"),
                        ),
                    },
                );
                expect(membership).toBeUndefined();
            },
            500_000,
        );

        integrationTest(
            "the sitting HS leader keeps the seat when a verv is taken away",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                await ctx.utils.createTestGroup(HS);
                const client = await ctx.utils.clientForUser(admin);
                const president = await ctx.utils.createTestUser();

                await addUserToGroup(ctx, president.id, "hs", "leader");
                const [position] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({ groupSlug: "hs", name: "President" })
                    .returning();
                await ctx.db.insert(schema.groupPositionHolder).values({
                    positionId: position!.id,
                    userId: president.id,
                });

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: "hs",
                        positionId: position!.id,
                        userId: president.id,
                    },
                });

                expect(response.status).toBe(200);

                // Ledervervet i HS er sin egen grunn til a sitte der.
                const membership = await ctx.db.query.groupMembership.findFirst(
                    {
                        where: and(
                            eq(schema.groupMembership.userId, president.id),
                            eq(schema.groupMembership.groupSlug, "hs"),
                        ),
                    },
                );
                expect(membership?.role).toBe("leader");
            },
            500_000,
        );
    });

    describe("leader permissions follow leadership", () => {
        integrationTest(
            "promoting and demoting moves the group's leaderPermissions",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ leaderPermissions: ["events:payments:refund"] })
                    .where(eq(schema.group.slug, group.slug));

                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const scoped = `events:payments:refund@group:${group.slug}`;

                // A plain member does not hold the leader's set
                expect(await getUserPermissions(ctx, user.id)).not.toContain(
                    scoped,
                );

                // Promote to leader → granted, with nothing written to sync
                await updateGroupMemberRole(ctx, user.id, group.slug, "leader");
                expect(await getUserPermissions(ctx, user.id)).toContain(
                    scoped,
                );

                // Demote → gone again on the next check
                await updateGroupMemberRole(ctx, user.id, group.slug, "member");
                expect(await getUserPermissions(ctx, user.id)).not.toContain(
                    scoped,
                );
            },
            500_000,
        );

        integrationTest(
            "memberPermissions reach every member, scoped to the group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();
                // Explicit slug: createTestGroup derives one from Date.now(),
                // so two in the same millisecond collide on the primary key.
                const other = await ctx.utils.createTestGroup({
                    slug: `member-perms-other-${crypto.randomUUID()}`,
                });

                await ctx.db
                    .update(schema.group)
                    .set({
                        memberPermissions: ["events:create"],
                        memberGlobalPermissions: ["news:view"],
                    })
                    .where(eq(schema.group.slug, group.slug));

                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const permissions = await getUserPermissions(ctx, user.id);
                expect(permissions).toContain(
                    `events:create@group:${group.slug}`,
                );
                // Scoped, so it never reaches another group's events
                expect(permissions).not.toContain(
                    `events:create@group:${other.slug}`,
                );
                expect(permissions).not.toContain("events:create");
                // The global list is unscoped on purpose
                expect(permissions).toContain("news:view");
            },
            500_000,
        );
    });

    describe("baseline role sync", () => {
        integrationTest(
            "active student gets member, only study-programme history earns alumni, stranger gets nothing",
            async ({ ctx }) => {
                const memberRole = await createTestingRole(ctx, {
                    name: "member",
                    permissions: ["events:view"],
                    description: "baseline member",
                    position: 2,
                });
                await createTestingRole(ctx, {
                    name: "alumni",
                    permissions: ["events:view"],
                    description: "baseline alumni",
                    position: 1,
                });

                const student = await ctx.utils.createTestUser();
                const alumnus = await ctx.utils.createTestUser();
                const stranger = await ctx.utils.createTestUser();

                // Only a study-programme membership counts as proof that we
                // once saw someone enrolled. Group memberships do not: every
                // member migrated from Lepton has those, so treating them as
                // history demoted the whole membership the first time Feide
                // came back empty.
                const [program] = await ctx.db
                    .insert(schema.studyProgram)
                    .values({
                        slug: "baseline-roles-program",
                        feideCode: "BIDATA",
                        displayName: "Dataingeniør",
                        type: "bachelor",
                    })
                    .returning();
                if (!program) throw new Error("Could not seed study programme");

                await ctx.db.insert(schema.studyProgramMembership).values({
                    userId: alumnus.id,
                    studyProgramId: program.id,
                    startYear: 2019,
                });

                await ctx.db.transaction(async (tx) => {
                    await syncBaselineRoles(tx, student.id, true);
                    await syncBaselineRoles(tx, alumnus.id, false);
                    await syncBaselineRoles(tx, stranger.id, false);
                });

                expect(await getUserRoles(ctx, student.id)).toContain("member");
                expect(await getUserRoles(ctx, alumnus.id)).toContain("alumni");
                const strangerRoles = await getUserRoles(ctx, stranger.id);
                expect(strangerRoles).not.toContain("member");
                expect(strangerRoles).not.toContain("alumni");

                // A group membership alone must never cost anyone "member":
                // an empty Feide result is equally consistent with the
                // programme simply not coming through.
                const group = await ctx.utils.createTestGroup();
                await ctx.db.insert(schema.groupMembership).values({
                    userId: student.id,
                    groupSlug: group.slug,
                    role: "member",
                });
                await ctx.db.transaction(async (tx) => {
                    await syncBaselineRoles(tx, student.id, false);
                });
                expect(await getUserRoles(ctx, student.id)).toContain("member");

                // Graduating: once a study programme proves they were
                // enrolled, an empty Feide result does mean they finished.
                await ctx.db.insert(schema.studyProgramMembership).values({
                    userId: student.id,
                    studyProgramId: program.id,
                    startYear: 2021,
                });
                await ctx.db.transaction(async (tx) => {
                    await syncBaselineRoles(tx, student.id, false);
                });
                const graduated = await getUserRoles(ctx, student.id);
                expect(graduated).not.toContain("member");
                expect(graduated).toContain("alumni");

                // Sanity: the member role row still exists (we removed the
                // assignment, not the role)
                expect(memberRole.name).toBe("member");
            },
            500_000,
        );
    });

    describe("fines member visibility", () => {
        integrationTest(
            "group member without permissions can list group fines, outsider cannot",
            async ({ ctx }) => {
                const member = await ctx.utils.createTestUser();
                const outsider = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup({
                    finesActivated: true,
                });

                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const memberClient = await ctx.utils.clientForUser(member);
                const memberResponse = await memberClient.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });
                expect(memberResponse.status).toBe(200);

                const outsiderClient = await ctx.utils.clientForUser(outsider);
                const outsiderResponse = await outsiderClient.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                    query: {},
                });
                expect(outsiderResponse.status).toBe(403);
            },
            500_000,
        );
    });
});
