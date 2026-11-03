import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const PRIVATE_SLUG = "private-current";
const FORMER_PRIVATE_SLUG = "private-former";
const OPEN_SLUG = "open-current";
const FORMER_OPEN_SLUG = "open-former";

async function setupTarget(ctx: IntegrationTestContext) {
    const target = await ctx.utils.createTestUser();

    await ctx.utils.createTestGroup({ slug: PRIVATE_SLUG, type: "PRIVATE" });
    await ctx.utils.createTestGroup({
        slug: FORMER_PRIVATE_SLUG,
        type: "PRIVATE",
    });
    await ctx.utils.createTestGroup({ slug: OPEN_SLUG, type: "SUBGROUP" });
    await ctx.utils.createTestGroup({
        slug: FORMER_OPEN_SLUG,
        type: "SUBGROUP",
    });

    await ctx.db.insert(schema.groupMembership).values([
        { userId: target.id, groupSlug: PRIVATE_SLUG, role: "member" },
        { userId: target.id, groupSlug: OPEN_SLUG, role: "member" },
    ]);
    await ctx.db.insert(schema.groupMembershipHistory).values([
        {
            userId: target.id,
            groupSlug: FORMER_PRIVATE_SLUG,
            role: "member",
            startedAt: new Date("2023-08-01"),
        },
        {
            userId: target.id,
            groupSlug: FORMER_OPEN_SLUG,
            role: "member",
            startedAt: new Date("2023-08-01"),
        },
    ]);

    return target;
}

async function profileSlugs(
    ctx: IntegrationTestContext,
    viewer: Awaited<
        ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
    >,
    targetId: string,
) {
    const client = await ctx.utils.clientForUser(viewer);
    const res = await client.api.user[":id"].$get({
        param: { id: targetId },
    });
    expect(res.status).toBe(200);
    const json = await res.json();

    return {
        current: json.groups.map((group) => group.slug).sort(),
        former: json.formerGroups.map((group) => group.slug).sort(),
    };
}

describe("GET /api/user/:id — private groups", () => {
    integrationTest(
        "another member sees only the open groups",
        async ({ ctx }) => {
            const target = await setupTarget(ctx);
            const viewer = await ctx.utils.createTestUser();

            expect(await profileSlugs(ctx, viewer, target.id)).toEqual({
                current: [OPEN_SLUG],
                former: [FORMER_OPEN_SLUG],
            });
        },
    );

    integrationTest("the profile's owner sees all of them", async ({ ctx }) => {
        const target = await setupTarget(ctx);

        expect(await profileSlugs(ctx, target, target.id)).toEqual({
            current: [OPEN_SLUG, PRIVATE_SLUG].sort(),
            former: [FORMER_OPEN_SLUG, FORMER_PRIVATE_SLUG].sort(),
        });
    });

    integrationTest(
        "a member of a private group sees that group and no other",
        async ({ ctx }) => {
            const target = await setupTarget(ctx);
            const viewer = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: viewer.id,
                groupSlug: PRIVATE_SLUG,
                role: "member",
            });

            expect(await profileSlugs(ctx, viewer, target.id)).toEqual({
                current: [OPEN_SLUG, PRIVATE_SLUG].sort(),
                former: [FORMER_OPEN_SLUG],
            });
        },
    );

    integrationTest("groups:manage sees all of them", async ({ ctx }) => {
        const target = await setupTarget(ctx);
        const viewer = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(viewer, ["groups:manage"]);

        expect(await profileSlugs(ctx, viewer, target.id)).toEqual({
            current: [OPEN_SLUG, PRIVATE_SLUG].sort(),
            former: [FORMER_OPEN_SLUG, FORMER_PRIVATE_SLUG].sort(),
        });
    });
});
