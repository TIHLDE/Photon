import { getUserPermissions } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { updateGroupMemberRole } from "~/lib/group";
import { integrationTest } from "~/test/config/integration";

/**
 * Tests for the group leader's own permission set: granted scoped to the
 * group, following whoever leads it, and editable from the verv table.
 *
 * The reason this exists at all: before it, giving a committee leader the
 * right to run their own arrangementer meant a *global* events grant, which
 * opened every other group's events too.
 */

describe("group leader permissions", () => {
    describe("granting", () => {
        integrationTest(
            "the leader holds them scoped to the group, and loses them on stepping down",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ leaderPermissions: ["events:create"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const asLeader = await getUserPermissions(ctx, leader.id);
                expect(asLeader).toContain(`events:create@group:${group.slug}`);
                // Scoped, never global — the whole point.
                expect(asLeader).not.toContain("events:create");

                await updateGroupMemberRole(
                    ctx,
                    leader.id,
                    group.slug,
                    "member",
                );

                const asMember = await getUserPermissions(ctx, leader.id);
                expect(asMember).not.toContain(
                    `events:create@group:${group.slug}`,
                );
            },
            500_000,
        );

        integrationTest(
            "an ordinary member of the group gets nothing from them",
            async ({ ctx }) => {
                const member = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ leaderPermissions: ["events:create"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: member.id,
                    groupSlug: group.slug,
                    role: "member",
                });

                const permissions = await getUserPermissions(ctx, member.id);
                expect(permissions).not.toContain(
                    `events:create@group:${group.slug}`,
                );
            },
            500_000,
        );
    });

    describe("editing", () => {
        integrationTest(
            "a leader can set permissions they hold for the group",
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
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: { permissions: ["news:manage"] },
                });

                expect(response.status).toBe(200);
                const json = await response.json();
                expect(json.permissions).toEqual(["news:manage"]);
            },
            500_000,
        );

        integrationTest(
            "a leader cannot hand out permissions they do not hold",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const response = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: { permissions: ["events:payments:refund"] },
                });

                expect(response.status).toBe(403);
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
                    "leader-permissions"
                ].$get({ param: { groupSlug: group.slug } });
                expect(read.status).toBe(403);

                const write = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: { permissions: [] },
                });
                expect(write.status).toBe(403);
            },
            500_000,
        );
    });

    /**
     * The org-wide half of the leader's set. It exists because the rights a
     * president needs outside HS could otherwise only live in a global verv
     * shadowing the leader row.
     */
    describe("global permissions", () => {
        integrationTest(
            "the leader holds them unscoped, and loses them on stepping down",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const group = await ctx.utils.createTestGroup();

                await ctx.db
                    .update(schema.group)
                    .set({ leaderGlobalPermissions: ["news:manage"] })
                    .where(eq(schema.group.slug, group.slug));
                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                expect(await getUserPermissions(ctx, leader.id)).toContain(
                    "news:manage",
                );

                await updateGroupMemberRole(
                    ctx,
                    leader.id,
                    group.slug,
                    "member",
                );

                expect(await getUserPermissions(ctx, leader.id)).not.toContain(
                    "news:manage",
                );
            },
            500_000,
        );

        integrationTest(
            "a group leader cannot grant them from a right they only hold for their group",
            async ({ ctx }) => {
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

                // Holds news:manage@group:<slug>, so the group list is fine…
                const scoped = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: { permissions: ["news:manage"] },
                });
                expect(scoped.status).toBe(200);

                // …but the same permission org-wide is an escalation.
                const global = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        permissions: ["news:manage"],
                        globalPermissions: ["news:manage"],
                    },
                });
                expect(global.status).toBe(403);
            },
            500_000,
        );

        integrationTest(
            "omitting the list leaves it alone",
            async ({ ctx }) => {
                const admin = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(admin);
                const group = await ctx.utils.createTestGroup();

                await ctx.utils.giveUserPermissions(admin, [
                    "roles:create",
                    "news:manage",
                ]);

                const granted = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: {
                        permissions: [],
                        globalPermissions: ["news:manage"],
                    },
                });
                expect(granted.status).toBe(200);
                expect((await granted.json()).globalPermissions).toEqual([
                    "news:manage",
                ]);

                const untouched = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$patch({
                    param: { groupSlug: group.slug },
                    json: { permissions: [] },
                });
                expect((await untouched.json()).globalPermissions).toEqual([
                    "news:manage",
                ]);
            },
            500_000,
        );
    });

    /**
     * The group's own name for the role. It exists so HS does not need a verv
     * called "President" held by the same person as the leader row.
     */
    describe("title", () => {
        integrationTest(
            "a leader can name the role, clear it, and leave it untouched",
            async ({ ctx }) => {
                const leader = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(leader);
                const group = await ctx.utils.createTestGroup();

                await ctx.db.insert(schema.groupMembership).values({
                    userId: leader.id,
                    groupSlug: group.slug,
                    role: "leader",
                });

                const patch = (json: {
                    permissions: string[];
                    title?: string | null;
                }) =>
                    client.api.groups[":groupSlug"][
                        "leader-permissions"
                    ].$patch({ param: { groupSlug: group.slug }, json });

                const named = await patch({
                    permissions: [],
                    title: "President",
                });
                expect(named.status).toBe(200);
                expect((await named.json()).title).toBe("President");

                // Omitting the field edits permissions without touching the name.
                const untouched = await patch({ permissions: [] });
                expect((await untouched.json()).title).toBe("President");

                const read = await client.api.groups[":groupSlug"][
                    "leader-permissions"
                ].$get({ param: { groupSlug: group.slug } });
                expect((await read.json()).title).toBe("President");

                const cleared = await patch({ permissions: [], title: null });
                expect((await cleared.json()).title).toBeNull();
            },
            500_000,
        );
    });
});
