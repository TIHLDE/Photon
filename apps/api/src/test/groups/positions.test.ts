import { syncBaselineRoles } from "@photon/auth/feide";
import { getUserPermissions } from "@photon/auth/rbac";
import { createTestingRole, getUserRoles } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
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
                await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Økonomiansvarlig",
                        permissions: ["forms:manage"],
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
                await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Global Sneaky",
                        permissions: ["forms:manage"],
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

    describe("permissions that cannot apply to a single group", () => {
        integrationTest(
            "are refused on a group-scoped verv, and only when the list changes",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                const client = await ctx.utils.clientForUser(admin);
                const group = await ctx.utils.createTestGroup();

                const refused = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Redaktør",
                        permissions: ["forms:manage", "news:manage"],
                        scope: "group",
                    },
                });
                expect(refused.status).toBe(400);

                const global = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Redaktør",
                        permissions: ["news:manage"],
                        scope: "global",
                    },
                });
                expect(global.status).toBe(201);

                // A verv saved before the rule still renames without a cleanup.
                const [legacy] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({
                        groupSlug: group.slug,
                        name: "Gammelt verv",
                        permissions: ["forms:manage", "news:manage"],
                        scope: "group",
                    })
                    .returning();
                if (!legacy) throw new Error("Failed to seed position");

                const renamed = await client.api.groups[":groupSlug"].positions[
                    ":positionId"
                ].$patch({
                    param: { groupSlug: group.slug, positionId: legacy.id },
                    json: { name: "Nytt navn" },
                });
                expect(renamed.status).toBe(200);

                const resaved = await client.api.groups[":groupSlug"].positions[
                    ":positionId"
                ].$patch({
                    param: { groupSlug: group.slug, positionId: legacy.id },
                    json: { permissions: ["forms:manage", "news:manage"] },
                });
                expect(resaved.status).toBe(400);
            },
            500_000,
        );

        integrationTest(
            "grant nothing when held for a group",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();
                await ctx.db
                    .update(schema.group)
                    .set({ memberPermissions: ["news:manage", "forms:manage"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const permissions = await getUserPermissions(ctx, user.id);
                expect(permissions).toContain(
                    `forms:manage@group:${group.slug}`,
                );
                expect(permissions).not.toContain(
                    `news:manage@group:${group.slug}`,
                );
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
                await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["forms:manage"],
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
                    `forms:manage@group:${group.slug}`,
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
                expect(after).not.toContain(`forms:manage@group:${group.slug}`);
            },
            500_000,
        );

        integrationTest(
            "a position can be shared by several holders",
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
                await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Økonomiansvarlig",
                        permissions: ["forms:manage"],
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

                // To økonomiansvarlige deler ett verv i stedet for å tvinge
                // gruppa til å holde to like rader i sync (issue #646).
                const assignSecond = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders.$post({
                    param: { groupSlug: group.slug, positionId: position.id },
                    json: { userId: second.id },
                });
                expect(assignSecond.status).toBe(200);

                const listResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$get({ param: { groupSlug: group.slug } });
                const positions = await listResponse.json();
                const shared = positions.find((p) => p.id === position.id);
                expect(
                    shared?.holders.map((holder) => holder.userId).sort(),
                ).toEqual([first.id, second.id].sort());

                // Og begge har faktisk tilgangen vervet gir.
                for (const holder of [first, second]) {
                    const permissions = await getUserPermissions(
                        ctx,
                        holder.id,
                    );
                    expect(permissions).toContain(
                        `forms:manage@group:${group.slug}`,
                    );
                }
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
                await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["forms:manage"],
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
                await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["forms:manage"],
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

    describe("HS is managed by hand", () => {
        const HS = { slug: "hs", name: "Hovedstyret", type: "board" };

        integrationTest(
            "becoming a subgroup leader does not seat anyone in HS",
            async ({ ctx }) => {
                await ctx.utils.createTestGroup(HS);
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Testgruppen",
                });
                const leader = await ctx.utils.createTestUser();
                const successor = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);

                await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");
                await addUserToGroup(
                    ctx,
                    successor.id,
                    subgroup.slug,
                    "member",
                );

                // The leader hands the leadership over — the path the old
                // sync used to seat the successor in HS.
                const response = await client.api.groups[":groupSlug"].members[
                    ":userId"
                ].$patch({
                    param: { groupSlug: subgroup.slug, userId: successor.id },
                    json: { role: "leader" },
                });
                expect(response.status).toBe(200);

                const hsMembers = await ctx.db.query.groupMembership.findMany({
                    where: { groupSlug: "hs" },
                });
                expect(hsMembers).toHaveLength(0);

                // No verv is conjured up in HS either.
                const positions = await ctx.db
                    .select()
                    .from(schema.groupPosition)
                    .where(eq(schema.groupPosition.groupSlug, "hs"));
                expect(positions).toHaveLength(0);
            },
            500_000,
        );

        integrationTest(
            "a subgroup's leader role and an HS verv are separate grants",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.createTestGroup(HS);
                const index = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Index",
                });
                const [minister] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({
                        groupSlug: "hs",
                        name: "Teknologiminister",
                        permissions: [],
                        scope: "global",
                    })
                    .returning();

                // Index gives its leader root; the HS verv gives nothing.
                const leaderWrite = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: index.slug },
                    json: {
                        permissions: [],
                        globalPermissions: ["root"],
                        title: "Teknologiminister",
                    },
                });
                expect(leaderWrite.status).toBe(200);

                // Editing the verv leaves Index's leader role alone.
                const vervWrite = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].$patch({
                    param: { groupSlug: "hs", positionId: minister!.id },
                    json: { name: "Digitalminister", permissions: [] },
                });
                expect(vervWrite.status).toBe(200);

                const group = await ctx.db.query.group.findFirst({
                    where: { slug: index.slug },
                });
                expect(group?.leaderGlobalPermissions).toEqual(["root"]);
                expect(group?.leaderTitle).toBe("Teknologiminister");

                const verv = await ctx.db.query.groupPosition.findFirst({
                    where: { id: minister!.id },
                });
                expect(verv?.permissions).toEqual([]);
                expect(verv?.name).toBe("Digitalminister");

                // Each page reports only its own role.
                const leaderRead = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$get({ param: { groupSlug: index.slug } });
                const leaderJson = await leaderRead.json();
                expect(leaderJson.globalPermissions).toEqual(["root"]);

                // The leader of Index has root from the leader role, whatever
                // the HS verv says — and loses it with the leadership.
                const leader = await ctx.utils.createTestUser();
                await addUserToGroup(ctx, leader.id, "hs", "member");
                await addUserToGroup(ctx, leader.id, index.slug, "leader");
                await ctx.db.insert(schema.groupPositionHolder).values({
                    positionId: minister!.id,
                    userId: leader.id,
                });
                expect(await getUserPermissions(ctx, leader.id)).toContain(
                    "root",
                );

                await updateGroupMemberRole(
                    ctx,
                    leader.id,
                    index.slug,
                    "member",
                );
                expect(await getUserPermissions(ctx, leader.id)).not.toContain(
                    "root",
                );
            },
            500_000,
        );

        integrationTest(
            "a minister verv in HS is assigned and unassigned by hand",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.createTestGroup(HS);
                const [minister] = await ctx.db
                    .insert(schema.groupPosition)
                    .values({
                        groupSlug: "hs",
                        name: "Teknologiminister",
                        scope: "global",
                    })
                    .returning();
                const holder = await ctx.utils.createTestUser();
                await addUserToGroup(ctx, holder.id, "hs", "member");

                const assign = await client.api.groups[":groupSlug"].positions[
                    ":positionId"
                ].holders.$post({
                    param: { groupSlug: "hs", positionId: minister!.id },
                    json: { userId: holder.id },
                });
                expect(assign.status).toBe(200);

                const unassign = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: "hs",
                        positionId: minister!.id,
                        userId: holder.id,
                    },
                });
                expect(unassign.status).toBe(200);

                const holders = await ctx.db
                    .select()
                    .from(schema.groupPositionHolder)
                    .where(
                        eq(schema.groupPositionHolder.positionId, minister!.id),
                    );
                expect(holders).toHaveLength(0);
            },
            500_000,
        );

        integrationTest(
            "nothing takes an HS seat away automatically",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(admin, ["root"]);
                const client = await ctx.utils.clientForUser(admin);
                await ctx.utils.createTestGroup(HS);
                const subgroup = await ctx.utils.createTestGroup({
                    type: "subgroup",
                    name: "Undergruppen",
                });
                const leader = await ctx.utils.createTestUser();
                const minister = await ctx.utils.createTestUser();
                const visepresident = await ctx.utils.createTestUser();

                for (const user of [leader, minister, visepresident]) {
                    await addUserToGroup(ctx, user.id, "hs", "member");
                }
                await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

                const [finansminister, vp] = await ctx.db
                    .insert(schema.groupPosition)
                    .values([
                        { groupSlug: "hs", name: "Finansminister" },
                        { groupSlug: "hs", name: "Visepresident" },
                    ])
                    .returning();
                await ctx.db.insert(schema.groupPositionHolder).values([
                    { positionId: finansminister!.id, userId: minister.id },
                    { positionId: vp!.id, userId: visepresident.id },
                ]);

                // Losing a subgroup's leadership.
                await updateGroupMemberRole(
                    ctx,
                    leader.id,
                    subgroup.slug,
                    "member",
                );

                // Losing an AU verv.
                const unassign = await client.api.groups[
                    ":groupSlug"
                ].positions[":positionId"].holders[":userId"].$delete({
                    param: {
                        groupSlug: "hs",
                        positionId: finansminister!.id,
                        userId: minister.id,
                    },
                });
                expect(unassign.status).toBe(200);

                // An AU verv being deleted outright.
                const deleted = await client.api.groups[":groupSlug"].positions[
                    ":positionId"
                ].$delete({
                    param: { groupSlug: "hs", positionId: vp!.id },
                });
                expect(deleted.status).toBe(200);

                const hsMembers = await ctx.db.query.groupMembership.findMany({
                    where: { groupSlug: "hs" },
                });
                expect(hsMembers.map((m) => m.userId).sort()).toEqual(
                    [leader.id, minister.id, visepresident.id].sort(),
                );
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

                // `feideActive` er det som gjør raden til bevis: bare en
                // Feide-innlogging skriver den, og den skriver den hver gang —
                // `false` også, siden et utløpt medlemskap fortsatt kommer med
                // i `showAll=true`. En rad uten den er et gjett (fadderuka-
                // registreringa, eller en manuell kullretting), ikke historikk.
                await ctx.db.insert(schema.studyProgramMembership).values({
                    userId: alumnus.id,
                    studyProgramId: program.id,
                    startYear: 2019,
                    startYearSource: "feide",
                    feideActive: false,
                });

                await ctx.db.transaction(async (tx) => {
                    await syncBaselineRoles(tx, student.id, true);
                    // Fixed date, outside the semester registration window: an
                    // inactive reading is deliberately no verdict inside it, so
                    // with the wall clock this case would flip every September.
                    await syncBaselineRoles(
                        tx,
                        alumnus.id,
                        false,
                        [],
                        new Date("2026-10-01T09:00:00Z"),
                    );
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

                // Graduating: once a login has seen them enrolled, an empty
                // Feide result does mean they finished. `feideActive: false`
                // is that login — the lapsed membership `showAll=true` still
                // returns.
                await ctx.db.insert(schema.studyProgramMembership).values({
                    userId: student.id,
                    studyProgramId: program.id,
                    startYear: 2021,
                    startYearSource: "feide",
                    feideActive: false,
                });
                await ctx.db.transaction(async (tx) => {
                    await syncBaselineRoles(
                        tx,
                        student.id,
                        false,
                        [],
                        new Date("2026-10-01T09:00:00Z"),
                    );
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
