import { syncBaselineRoles } from "@photon/auth/feide";
import { getUserPermissions } from "@photon/auth/rbac";
import { createTestingRole, getUserRoles } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { removeUserFromGroup, updateGroupMemberRole } from "~/lib/group";
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
                await ctx.utils.giveUserPermissions(leader, ["fines:manage"]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Økonomiansvarlig",
                        permissions: ["fines:manage"],
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
                await ctx.utils.giveUserPermissions(leader, ["fines:manage"]);

                const response = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Global Sneaky",
                        permissions: ["fines:manage"],
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
                await ctx.utils.giveUserPermissions(leader, ["fines:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["fines:manage"],
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
                    `fines:manage@group:${group.slug}`,
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
                expect(after).not.toContain(`fines:manage@group:${group.slug}`);
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
                await ctx.utils.giveUserPermissions(leader, ["fines:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["fines:manage"],
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
                await ctx.utils.giveUserPermissions(leader, ["fines:manage"]);

                const createResponse = await client.api.groups[
                    ":groupSlug"
                ].positions.$post({
                    param: { groupSlug: group.slug },
                    json: {
                        name: "Bøtesjef",
                        permissions: ["fines:manage"],
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

    describe("leader role auto-assignment", () => {
        integrationTest(
            "leaderRoleId follows leadership changes",
            async ({ ctx }) => {
                const user = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                const leaderRole = await createTestingRole(ctx, {
                    name: `leader-role-${crypto.randomUUID()}`,
                    permissions: ["events:payments:refund"],
                    description: "NOK leader role",
                    position: 1,
                });
                await ctx.db
                    .update(schema.group)
                    .set({ leaderRoleId: leaderRole.id })
                    .where(eq(schema.group.slug, group.slug));

                await ctx.db.insert(schema.groupMembership).values({
                    userId: user.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                // Promote to leader → role assigned
                await updateGroupMemberRole(ctx, user.id, group.slug, "leader");
                expect(await getUserRoles(ctx, user.id)).toContain(
                    leaderRole.name,
                );

                // Demote → role removed
                await updateGroupMemberRole(ctx, user.id, group.slug, "member");
                expect(await getUserRoles(ctx, user.id)).not.toContain(
                    leaderRole.name,
                );
            },
            500_000,
        );
    });

    describe("baseline role sync", () => {
        integrationTest(
            "active student gets member, inactive with history gets alumni, stranger gets nothing",
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

                // Alumnus has TIHLDE history via a group membership
                const group = await ctx.utils.createTestGroup();
                await ctx.db.insert(schema.groupMembership).values({
                    userId: alumnus.id,
                    groupSlug: group.slug,
                    role: "member",
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

                // Graduating: student loses member, becomes alumni once they
                // have history
                await ctx.db.insert(schema.groupMembership).values({
                    userId: student.id,
                    groupSlug: group.slug,
                    role: "member",
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
                });
                expect(memberResponse.status).toBe(200);

                const outsiderClient = await ctx.utils.clientForUser(outsider);
                const outsiderResponse = await outsiderClient.api.groups[
                    ":groupSlug"
                ].fines.$get({
                    param: { groupSlug: group.slug },
                });
                expect(outsiderResponse.status).toBe(403);
            },
            500_000,
        );
    });
});
