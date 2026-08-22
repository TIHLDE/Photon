import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { AppContext } from "~/lib/ctx";
import { addUserToGroup, updateGroupMemberRole } from "~/lib/group";
import { integrationTest } from "~/test/config/integration";

async function leadersOf(
    ctx: AppContext,
    groupSlug: string,
): Promise<string[]> {
    const rows = await ctx.db
        .select({ userId: schema.groupMembership.userId })
        .from(schema.groupMembership)
        .where(
            and(
                eq(schema.groupMembership.groupSlug, groupSlug),
                eq(schema.groupMembership.role, "leader"),
            ),
        );
    return rows.map((row) => row.userId).sort();
}

/**
 * En gruppe har én leder — bortsett fra interessegrupper, som gjerne startes
 * av flere sammen og derfor kan ha flere ledere samtidig (issue #646).
 */
describe("flere ledere i interessegrupper", () => {
    integrationTest(
        "en interessegruppe beholder den sittende lederen når en ny legges til",
        async ({ ctx }) => {
            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                type: "interestgroup",
            });

            await addUserToGroup(ctx, first.id, group.slug, "leader");
            await addUserToGroup(ctx, second.id, group.slug, "member");
            await updateGroupMemberRole(ctx, second.id, group.slug, "leader");

            expect(await leadersOf(ctx, group.slug)).toEqual(
                [first.id, second.id].sort(),
            );
        },
        500_000,
    );

    integrationTest(
        "andre grupper setter fortsatt den forrige lederen ned",
        async ({ ctx }) => {
            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                type: "committee",
            });

            await addUserToGroup(ctx, first.id, group.slug, "leader");
            await addUserToGroup(ctx, second.id, group.slug, "member");
            await updateGroupMemberRole(ctx, second.id, group.slug, "leader");

            expect(await leadersOf(ctx, group.slug)).toEqual([second.id]);
        },
        500_000,
    );
});
