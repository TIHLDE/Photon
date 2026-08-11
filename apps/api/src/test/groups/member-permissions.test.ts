import { getUserPermissions } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * What every member of a group holds.
 *
 * This replaced `group.roleId`, which auto-assigned an RBAC role on join and
 * made "everyone in Index administers TIHLDE" a fact you could only find in
 * the database. The two lists are kept apart on purpose: the scoped one is the
 * everyday case, and the global one is the big hammer that only someone who
 * already holds the permission org-wide may swing.
 */

describe("group member permissions", () => {
    describe("granting", () => {
        integrationTest(
            "every member holds the scoped list, and loses it on leaving",
            async ({ ctx }) => {
                const member = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ memberPermissions: ["events:create"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.id,
                    groupSlug: group.slug,
                });

                const asMember = await getUserPermissions(ctx, member.id);
                expect(asMember).toContain(`events:create@group:${group.slug}`);
                // Scoped, never global — that is what keeps NoK out of
                // Sosialens arrangementer.
                expect(asMember).not.toContain("events:create");

                await ctx.db
                    .delete(schema.groupMembership)
                    .where(eq(schema.groupMembership.userId, member.id));

                const afterLeaving = await getUserPermissions(ctx, member.id);
                expect(afterLeaving).not.toContain(
                    `events:create@group:${group.slug}`,
                );
            },
            500_000,
        );

        integrationTest(
            "the global list is unscoped, and reaches every group",
            async ({ ctx }) => {
                const member = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ memberGlobalPermissions: ["news:manage"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.id,
                    groupSlug: group.slug,
                });

                expect(await getUserPermissions(ctx, member.id)).toContain(
                    "news:manage",
                );
            },
            500_000,
        );

        integrationTest(
            "the leader holds the member list on top of their own",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({
                        memberPermissions: ["events:create"],
                        leaderPermissions: ["events:delete"],
                    })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const permissions = await getUserPermissions(ctx, leader.id);
                expect(permissions).toContain(
                    `events:create@group:${group.slug}`,
                );
                expect(permissions).toContain(
                    `events:delete@group:${group.slug}`,
                );
            },
            500_000,
        );
    });

    describe("editing", () => {
        integrationTest(
            "a leader can set the scoped list from what they hold for the group",
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

                const response = await client.api.groups[":groupSlug"][
                    "member-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        permissions: ["news:manage"],
                        globalPermissions: [],
                    },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.permissions).toEqual(["news:manage"]);
                expect(json.globalPermissions).toEqual([]);
            },
            500_000,
        );

        integrationTest(
            "a group-scoped holder cannot promote it to the whole of TIHLDE",
            async ({ ctx }) => {
                // The escalation this guards against: a leader who may run
                // their own group's events handing every member of it the
                // right to run everyone's.
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ leaderPermissions: ["news:manage"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const scoped = await client.api.groups[":groupSlug"][
                    "member-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        permissions: ["news:manage"],
                        globalPermissions: [],
                    },
                });
                expect(scoped.status).toBe(200);

                const global = await client.api.groups[":groupSlug"][
                    "member-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        permissions: [],
                        globalPermissions: ["news:manage"],
                    },
                });
                expect(global.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "a global holder can set the global list",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                const group = await ctx.utils.createTestGroup();

                await ctx.utils.giveUserPermissions(admin, [
                    "roles:create",
                    "news:manage",
                ]);

                const response = await client.api.groups[":groupSlug"][
                    "member-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        permissions: [],
                        globalPermissions: ["news:manage"],
                    },
                });

                expect(response.status).toBe(200);
                expect((await response.json()).globalPermissions).toEqual([
                    "news:manage",
                ]);
            },
            500_000,
        );

        integrationTest(
            "an outsider cannot read or write them",
            async ({ ctx }) => {
                const outsider = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(outsider);
                const group = await ctx.utils.createTestGroup();

                const read = await client.api.groups[":groupSlug"][
                    "member-permissions"
                ].$get({ param: { groupSlug: group.slug } });
                expect(read.status).toBe(403);

                const write = await client.api.groups[":groupSlug"][
                    "member-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: { permissions: [], globalPermissions: [] },
                });
                expect(write.status).toBe(403);
            },
            500_000,
        );
    });
});
