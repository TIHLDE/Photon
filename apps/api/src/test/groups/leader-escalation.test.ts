import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

async function groupWithLeader(
    ctx: IntegrationTestContext,
    type = "INTERESTGROUP",
) {
    const group = await ctx.utils.createTestGroup({ type });
    const leader = await ctx.utils.createTestUser();
    await ctx.db.insert(schema.groupMembership).values({
        userId: leader.id,
        groupSlug: group.slug,
        role: "leader",
    });
    return { group, leader, client: await ctx.utils.clientForUser(leader) };
}

async function currentType(ctx: IntegrationTestContext, slug: string) {
    const row = await ctx.db.query.group.findFirst({ where: { slug } });
    return row?.type;
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

describe("group type", () => {
    integrationTest(
        "a leader cannot change it, but saving the same value still works",
        async ({ ctx }) => {
            const { group, client } = await groupWithLeader(ctx);

            const changed = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { type: "SUBGROUP" },
            });
            expect(changed.status).toBe(403);
            expect(await currentType(ctx, group.slug)).toBe("INTERESTGROUP");

            const subtype = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { subtype: "IDRETTSGRUPPE" },
            });
            expect(subtype.status).toBe(403);

            const unchanged = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { type: "interestgroup", name: "Nytt navn" },
            });
            expect(unchanged.status).toBe(200);
            expect(await currentType(ctx, group.slug)).toBe("INTERESTGROUP");

            const defaultSubtype = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { subtype: "GRUPPE" },
            });
            expect(defaultSubtype.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "a grant for the group alone is not enough",
        async ({ ctx }) => {
            const { group } = await groupWithLeader(ctx);
            const manager = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.userPermission).values(
                ["groups:manage", "groups:update"].map((permission) => ({
                    userId: manager.id,
                    permission,
                    scope: `group:${group.slug}`,
                })),
            );
            const client = await ctx.utils.clientForUser(manager);

            const res = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { type: "SUBGROUP" },
            });
            expect(res.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "groups:manage may switch between editable types only",
        async ({ ctx }) => {
            const { group } = await groupWithLeader(ctx);
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, [
                "groups:manage",
                "groups:update",
            ]);
            const client = await ctx.utils.clientForUser(admin);

            const ok = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { type: "committee" },
            });
            expect(ok.status).toBe(200);
            expect(await currentType(ctx, group.slug)).toBe("COMMITTEE");

            const refused = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { type: "STUDY" },
            });
            expect(refused.status).toBe(400);

            const study = await ctx.utils.createTestGroup({ type: "STUDY" });
            const fromGenerated = await client.api.groups[":slug"].$patch({
                param: { slug: study.slug },
                json: { type: "COMMITTEE" },
            });
            expect(fromGenerated.status).toBe(400);
        },
        500_000,
    );
});

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
        "appointing a subgroup leader requires what HS grants",
        async ({ ctx }) => {
            const hs = await ctx.utils.createTestGroup({
                slug: "hs",
                type: "BOARD",
            });
            await ctx.db
                .update(schema.group)
                .set({ memberGlobalPermissions: ["users:view"] })
                .where(eq(schema.group.slug, hs.slug));

            const { group } = await groupWithLeader(ctx, "SUBGROUP");
            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: group.slug,
                role: "member",
            });
            const manager = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["groups:manage"]);
            const client = await ctx.utils.clientForUser(manager);

            const res = await client.api.groups[":groupSlug"].members[
                ":userId"
            ].$patch({
                param: { groupSlug: group.slug, userId: member.id },
                json: { role: "leader" },
            });

            expect(res.status).toBe(403);
            expect(await membership(ctx, "hs", member.id)).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "a sitting subgroup leader can still hand over to a member",
        async ({ ctx }) => {
            const hs = await ctx.utils.createTestGroup({
                slug: "hs",
                type: "BOARD",
            });
            await ctx.db
                .update(schema.group)
                .set({ memberGlobalPermissions: ["users:view"] })
                .where(eq(schema.group.slug, hs.slug));

            const { group, leader, client } = await groupWithLeader(
                ctx,
                "SUBGROUP",
            );
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: "hs",
                role: "member",
            });
            const successor = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: successor.id,
                groupSlug: group.slug,
                role: "member",
            });

            const res = await client.api.groups[":groupSlug"].members[
                ":userId"
            ].$patch({
                param: { groupSlug: group.slug, userId: successor.id },
                json: { role: "leader" },
            });

            expect(res.status).toBe(200);
            expect(await membership(ctx, "hs", successor.id)).toBeDefined();
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
