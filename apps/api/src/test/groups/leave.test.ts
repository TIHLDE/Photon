import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

type Ctx = IntegrationTestContext;
type TestUser = Awaited<ReturnType<Ctx["utils"]["createTestUser"]>>;

async function leave(ctx: Ctx, user: TestUser, groupSlug: string) {
    const client = await ctx.utils.clientForUser(user);
    return client.api.groups[":groupSlug"].leave.$post({
        param: { groupSlug },
    });
}

async function membershipOf(ctx: Ctx, userId: string, groupSlug: string) {
    return ctx.db.query.groupMembership.findFirst({
        where: and(
            eq(schema.groupMembership.userId, userId),
            eq(schema.groupMembership.groupSlug, groupSlug),
        ),
    });
}

describe("leave group", () => {
    integrationTest(
        "a member leaves on their own and lands in the history",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                type: "INTERESTGROUP",
            });
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: user.id, groupSlug: group.slug });

            const res = await leave(ctx, user, group.slug);
            expect(res.status).toBe(204);
            expect(
                await membershipOf(ctx, user.id, group.slug),
            ).toBeUndefined();

            const history = await ctx.db.query.groupMembershipHistory.findMany({
                where: and(
                    eq(schema.groupMembershipHistory.userId, user.id),
                    eq(schema.groupMembershipHistory.groupSlug, group.slug),
                ),
            });
            expect(history).toHaveLength(1);
        },
    );

    integrationTest("a leader may leave too", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();
        const group = await ctx.utils.createTestGroup({
            type: "INTERESTGROUP",
        });
        await ctx.db
            .insert(schema.groupMembership)
            .values({ userId: user.id, groupSlug: group.slug, role: "leader" });

        const res = await leave(ctx, user, group.slug);
        expect(res.status).toBe(204);
        expect(await membershipOf(ctx, user.id, group.slug)).toBeUndefined();
    });

    integrationTest(
        "other groups cannot be left on one's own",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                type: "committee",
            });
            await ctx.db
                .insert(schema.groupMembership)
                .values({ userId: user.id, groupSlug: group.slug });

            const res = await leave(ctx, user, group.slug);
            expect(res.status).toBe(400);
            expect(await membershipOf(ctx, user.id, group.slug)).toBeDefined();
        },
    );

    integrationTest("a non-member gets a 404", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();
        const group = await ctx.utils.createTestGroup({
            type: "INTERESTGROUP",
        });

        const res = await leave(ctx, user, group.slug);
        expect(res.status).toBe(404);
    });
});
