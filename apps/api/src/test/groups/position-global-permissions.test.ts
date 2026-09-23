import { getUserPermissions } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("a group verv that also holds something for all of TIHLDE", () => {
    integrationTest(
        "its holder gets the global list globally, and only a global holder may hand it out",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            const leader = await ctx.utils.createTestUser();
            const annonsor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["root"]);
            await ctx.utils.giveUserPermissions(leader, ["forms:manage"]);
            const group = await ctx.utils.createTestGroup({ slug: "nok-test" });
            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: group.slug, role: "leader" },
                { userId: annonsor.id, groupSlug: group.slug, role: "member" },
            ]);

            const adminClient = await ctx.utils.clientForUser(admin);
            const leaderClient = await ctx.utils.clientForUser(leader);

            const created = await adminClient.api.groups[
                ":groupSlug"
            ].positions.$post({
                param: { groupSlug: group.slug },
                json: {
                    name: "Annonsør",
                    permissions: ["forms:manage"],
                    scope: "group",
                    globalPermissions: ["jobs:create"],
                },
            });
            expect(created.status).toBe(201);
            const position = await created.json();
            expect(position.scope).toBe("group");
            expect(position.globalPermissions).toEqual(["jobs:create"]);

            // The leader holds the group half, but no job rights of their own.
            const leaderAssign = await leaderClient.api.groups[
                ":groupSlug"
            ].positions[":positionId"].holders.$post({
                param: { groupSlug: group.slug, positionId: position.id },
                json: { userId: annonsor.id },
            });
            expect(leaderAssign.status).toBe(403);

            const leaderEdit = await leaderClient.api.groups[
                ":groupSlug"
            ].positions[":positionId"].$patch({
                param: { groupSlug: group.slug, positionId: position.id },
                json: { globalPermissions: ["jobs:create", "jobs:delete"] },
            });
            expect(leaderEdit.status).toBe(403);

            const adminAssign = await adminClient.api.groups[
                ":groupSlug"
            ].positions[":positionId"].holders.$post({
                param: { groupSlug: group.slug, positionId: position.id },
                json: { userId: annonsor.id },
            });
            expect(adminAssign.status).toBe(200);

            const permissions = await getUserPermissions(ctx, annonsor.id);
            expect(permissions).toContain("jobs:create");
            expect(permissions).toContain(`forms:manage@group:${group.slug}`);
        },
        500_000,
    );

    integrationTest(
        "a global verv keeps a single list",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["root"]);
            const group = await ctx.utils.createTestGroup();
            const client = await ctx.utils.clientForUser(admin);

            const response = await client.api.groups[
                ":groupSlug"
            ].positions.$post({
                param: { groupSlug: group.slug },
                json: {
                    name: "Minister",
                    permissions: ["news:manage"],
                    scope: "global",
                    globalPermissions: ["jobs:create"],
                },
            });
            expect(response.status).toBe(400);
        },
        500_000,
    );
});
