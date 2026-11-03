import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

async function groupWithLeader(ctx: IntegrationTestContext) {
    const group = await ctx.utils.createTestGroup({ type: "INTERESTGROUP" });
    const leader = await ctx.utils.createTestUser();
    await ctx.db.insert(schema.groupMembership).values({
        userId: leader.id,
        groupSlug: group.slug,
        role: "leader",
    });
    return { group, leader, client: await ctx.utils.clientForUser(leader) };
}

async function membership(
    ctx: IntegrationTestContext,
    groupSlug: string,
    userId: string,
) {
    return ctx.db.query.groupMembership.findFirst({
        where: { groupSlug, userId },
    });
}

describe("granting a group's org-wide permissions through membership", () => {
    async function privilegedGroup(ctx: IntegrationTestContext) {
        const group = await ctx.utils.createTestGroup({ type: "COMMITTEE" });
        await ctx.db
            .update(schema.group)
            .set({
                memberGlobalPermissions: ["roles:create", "api-keys:create"],
            })
            .where(eq(schema.group.slug, group.slug));
        return group;
    }

    integrationTest(
        "groups:manage alone cannot add anyone, itself included",
        async ({ ctx }) => {
            const group = await privilegedGroup(ctx);
            const manager = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["groups:manage"]);
            const client = await ctx.utils.clientForUser(manager);

            const res = await client.api.groups[":groupSlug"].members.$post({
                param: { groupSlug: group.slug },
                json: { userId: manager.id },
            });

            expect(res.status).toBe(403);
            expect(
                await membership(ctx, group.slug, manager.id),
            ).toBeUndefined();
            expect(await hasPermission(ctx, manager.id, "roles:create")).toBe(
                false,
            );
        },
        500_000,
    );

    integrationTest(
        "someone holding the permissions can add members",
        async ({ ctx }) => {
            const group = await privilegedGroup(ctx);
            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });
            const newcomer = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            const res = await client.api.groups[":groupSlug"].members.$post({
                param: { groupSlug: group.slug },
                json: { userId: newcomer.id },
            });

            expect(res.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "appointing a leader requires the group's leader permissions",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "COMMITTEE",
            });
            await ctx.db
                .update(schema.group)
                .set({ leaderGlobalPermissions: ["users:view"] })
                .where(eq(schema.group.slug, group.slug));
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: group.slug,
                role: "member",
            });
            const manager = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["groups:manage"]);
            const client = await ctx.utils.clientForUser(manager);

            const appointed = await client.api.groups[":groupSlug"].members[
                ":userId"
            ].$patch({
                param: { groupSlug: group.slug, userId: member.id },
                json: { role: "leader" },
            });
            expect(appointed.status).toBe(403);

            const added = await client.api.groups[":groupSlug"].members.$post({
                param: { groupSlug: group.slug },
                json: { userId: manager.id },
            });
            expect(added.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "approving a join request is held to the same rule",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            await ctx.db
                .update(schema.group)
                .set({ memberGlobalPermissions: ["users:view"] })
                .where(eq(schema.group.slug, group.slug));
            const requester = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupJoinRequest).values({
                userId: requester.id,
                groupSlug: group.slug,
            });
            const manager = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["groups:manage"]);
            const client = await ctx.utils.clientForUser(manager);

            const res = await client.api.groups[":groupSlug"]["join-requests"][
                ":userId"
            ].approve.$post({
                param: { groupSlug: group.slug, userId: requester.id },
            });

            expect(res.status).toBe(403);
            expect(
                await membership(ctx, group.slug, requester.id),
            ).toBeUndefined();
            expect(
                await ctx.db.query.groupJoinRequest.findFirst({
                    where: { groupSlug: group.slug, userId: requester.id },
                }),
            ).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "an interest group's leader still runs an ordinary roster",
        async ({ ctx }) => {
            const { group, client } = await groupWithLeader(ctx);
            const member = await ctx.utils.createTestUser();

            const added = await client.api.groups[":groupSlug"].members.$post({
                param: { groupSlug: group.slug },
                json: { userId: member.id },
            });
            expect(added.status).toBe(201);

            const promoted = await client.api.groups[":groupSlug"].members[
                ":userId"
            ].$patch({
                param: { groupSlug: group.slug, userId: member.id },
                json: { role: "leader" },
            });
            expect(promoted.status).toBe(200);
        },
        500_000,
    );
});
