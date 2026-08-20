import { getUserPermissions } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { addUserToGroup } from "~/lib/group";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * «Leder av Beta» and «Innovasjonsminister» are never two people — HS is AU
 * plus the leaders of the subgroups, so the linked verv and the subgroup's
 * org-wide leader permissions describe one person twice.
 *
 * They used to be two lists written from two admin pages with nothing keeping
 * them together, and in production they had drifted a long way apart: one
 * linked verv held `root`, two held nothing at all. Whichever page an admin
 * opened decided what they believed the leader could do.
 *
 * These tests pin the mirror: a write through either page lands in both rows,
 * and a read through either page reports the same set.
 */

/** The linked verv HS holds for `subgroupSlug`. */
async function linkedPosition(
    ctx: IntegrationTestContext,
    subgroupSlug: string,
) {
    const [position] = await ctx.db
        .select()
        .from(schema.groupPosition)
        .where(eq(schema.groupPosition.linkedGroupSlug, subgroupSlug));
    return position;
}

/**
 * A subgroup with a leader, which auto-creates the linked verv in HS, plus an
 * admin holding root to drive both admin pages.
 */
async function setup(ctx: IntegrationTestContext, name: string) {
    const leader = await ctx.utils.createTestUser();
    const admin = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(admin, ["root"]);
    const client = await ctx.utils.clientForUser(admin);

    await ctx.utils.createTestGroup({
        slug: "hs",
        name: "Hovedstyret",
        type: "board",
    });
    const subgroup = await ctx.utils.createTestGroup({
        type: "subgroup",
        name,
    });

    await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

    return { leader, client, subgroup };
}

describe("subgroup leader / linked HS verv parity", () => {
    integrationTest(
        "editing the subgroup's leader list writes the linked verv too",
        async ({ ctx }) => {
            const { client, subgroup } = await setup(ctx, "Speilgruppen");

            const response = await client.api.groups[":groupSlug"][
                "leader-permissions"
            ].$patch({
                param: { groupSlug: subgroup.slug },
                json: {
                    permissions: [],
                    globalPermissions: ["news:manage"],
                },
            });
            expect(response.status).toBe(200);

            const position = await linkedPosition(ctx, subgroup.slug);
            expect(position?.permissions).toEqual(["news:manage"]);
        },
        500_000,
    );

    integrationTest(
        "editing the linked verv writes the subgroup's leader list too",
        async ({ ctx }) => {
            const { client, subgroup } = await setup(ctx, "Vervgruppen");
            const position = await linkedPosition(ctx, subgroup.slug);

            const response = await client.api.groups[":groupSlug"].positions[
                ":positionId"
            ].$patch({
                param: { groupSlug: "hs", positionId: position!.id },
                json: { permissions: ["news:manage"] },
            });
            expect(response.status).toBe(200);

            const [group] = await ctx.db
                .select({
                    globalPermissions: schema.group.leaderGlobalPermissions,
                })
                .from(schema.group)
                .where(eq(schema.group.slug, subgroup.slug));
            expect(group?.globalPermissions).toEqual(["news:manage"]);
        },
        500_000,
    );

    /**
     * Existing rows are already out of step and this ships without a data
     * migration, so both pages have to agree on what is true before anyone
     * saves anything. They can, because the checker grants the union of the
     * two — reporting it is accuracy, not a widening.
     */
    integrationTest(
        "both pages report the union while the two rows still disagree",
        async ({ ctx }) => {
            const { client, subgroup } = await setup(ctx, "Driftgruppen");
            const position = await linkedPosition(ctx, subgroup.slug);

            // Drift, written straight to the rows as the old code left them.
            await ctx.db
                .update(schema.group)
                .set({ leaderGlobalPermissions: ["news:manage"] })
                .where(eq(schema.group.slug, subgroup.slug));
            await ctx.db
                .update(schema.groupPosition)
                .set({ permissions: ["jobs:manage"] })
                .where(eq(schema.groupPosition.id, position!.id));

            const fromGroup = await client.api.groups[":groupSlug"][
                "leader-permissions"
            ].$get({ param: { groupSlug: subgroup.slug } });
            expect(fromGroup.status).toBe(200);
            expect((await fromGroup.json()).globalPermissions.sort()).toEqual([
                "jobs:manage",
                "news:manage",
            ]);

            const fromHs = await client.api.groups[":groupSlug"].positions.$get(
                { param: { groupSlug: "hs" } },
            );
            expect(fromHs.status).toBe(200);
            const verv = (await fromHs.json()).find(
                (p: { id: string }) => p.id === position!.id,
            );
            expect(verv?.permissions.sort()).toEqual([
                "jobs:manage",
                "news:manage",
            ]);
        },
        500_000,
    );

    integrationTest(
        "a verv created for a new leader starts out agreeing with the group",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            await ctx.utils.createTestGroup({
                slug: "hs",
                name: "Hovedstyret",
                type: "board",
            });
            const subgroup = await ctx.utils.createTestGroup({
                type: "subgroup",
                name: "Nygruppen",
            });

            // The group's leader list is set before anyone leads it.
            await ctx.db
                .update(schema.group)
                .set({ leaderGlobalPermissions: ["news:manage"] })
                .where(eq(schema.group.slug, subgroup.slug));

            await addUserToGroup(ctx, leader.id, subgroup.slug, "leader");

            const position = await linkedPosition(ctx, subgroup.slug);
            expect(position?.permissions).toEqual(["news:manage"]);

            // And the holder really has it, from one source or the other.
            expect(await getUserPermissions(ctx, leader.id)).toContain(
                "news:manage",
            );
        },
        500_000,
    );

    integrationTest(
        "an unlinked verv is left alone",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["root"]);
            const client = await ctx.utils.clientForUser(admin);
            const group = await ctx.utils.createTestGroup();

            const created = await client.api.groups[":groupSlug"].positions[
                "$post"
            ]({
                param: { groupSlug: group.slug },
                json: {
                    name: "Økonomiansvarlig",
                    permissions: ["news:manage"],
                    scope: "group",
                },
            });
            expect(created.status).toBe(201);
            const position = await created.json();

            const response = await client.api.groups[":groupSlug"].positions[
                ":positionId"
            ].$patch({
                param: { groupSlug: group.slug, positionId: position.id },
                json: { permissions: ["jobs:manage"] },
            });
            expect(response.status).toBe(200);
            expect((await response.json()).permissions).toEqual([
                "jobs:manage",
            ]);

            // Nothing leaked into the group's leader list.
            const [row] = await ctx.db
                .select({
                    globalPermissions: schema.group.leaderGlobalPermissions,
                })
                .from(schema.group)
                .where(eq(schema.group.slug, group.slug));
            expect(row?.globalPermissions).toEqual([]);
        },
        500_000,
    );
});
