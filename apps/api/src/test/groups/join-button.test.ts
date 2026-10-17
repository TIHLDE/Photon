import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Join button", () => {
    integrationTest(
        "Only signed-in non-members of an open interest group get the leaders' emails",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            const leader = await ctx.utils.createTestUser();
            const member = await ctx.utils.createTestUser();
            const outsider = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values([
                { userId: leader.id, groupSlug: "biljard", role: "leader" },
                { userId: member.id, groupSlug: "biljard", role: "member" },
            ]);
            await ctx.db
                .update(schema.group)
                .set({ acceptsJoinRequests: true })
                .where(eq(schema.group.slug, "biljard"));

            const emailsFor = async (
                client: ReturnType<typeof ctx.utils.client>,
                slug: string,
            ) =>
                (
                    await (
                        await client.api.groups[":slug"].$get({
                            param: { slug },
                        })
                    ).json()
                ).leaderEmails;

            const outsiderClient = await ctx.utils.clientForUser(outsider);
            expect(await emailsFor(outsiderClient, "biljard")).toEqual([
                leader.email,
            ]);
            expect(await emailsFor(outsiderClient, "basket")).toEqual([]);
            expect(
                await emailsFor(
                    await ctx.utils.clientForUser(member),
                    "biljard",
                ),
            ).toEqual([]);
            expect(await emailsFor(ctx.utils.client(), "biljard")).toEqual([]);
        },
        500_000,
    );
});
