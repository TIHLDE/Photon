import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { HS_GROUP_SLUG } from "~/lib/group";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

async function globalDeleter(ctx: IntegrationTestContext) {
    const admin = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(admin, ["groups:delete"]);
    return ctx.utils.clientForUser(admin);
}

async function groupExists(ctx: IntegrationTestContext, slug: string) {
    return Boolean(await ctx.db.query.group.findFirst({ where: { slug } }));
}

describe("permanently deleting a group", () => {
    integrationTest(
        "a leader cannot, but can still archive",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                slug: "lederens-gruppe",
            });
            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });
            const client = await ctx.utils.clientForUser(leader);

            const deleted = await client.api.groups[":slug"].$delete({
                param: { slug: group.slug },
                query: { confirm: group.slug },
            });
            expect(deleted.status).toBe(403);
            expect(await groupExists(ctx, group.slug)).toBe(true);

            const archived = await client.api.groups[":slug"].archive.$post({
                param: { slug: group.slug },
            });
            expect(archived.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "groups:delete held only for this group is not enough",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                slug: "scopet-gruppe",
            });
            const leader = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["groups:delete"] })
                .where(eq(schema.group.slug, group.slug));
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });
            const client = await ctx.utils.clientForUser(leader);

            const deleted = await client.api.groups[":slug"].$delete({
                param: { slug: group.slug },
                query: { confirm: group.slug },
            });

            expect(deleted.status).toBe(403);
            expect(await groupExists(ctx, group.slug)).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "groups:delete across TIHLDE can delete an ordinary group",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                slug: "vanlig-gruppe",
                type: "interestgroup",
            });
            const client = await globalDeleter(ctx);

            const deleted = await client.api.groups[":slug"].$delete({
                param: { slug: group.slug },
                query: { confirm: group.slug },
            });

            expect(deleted.status).toBe(204);
            expect(await groupExists(ctx, group.slug)).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "not even groups:delete can delete Hovedstyret",
        async ({ ctx }) => {
            await ctx.utils.createTestGroup({ slug: HS_GROUP_SLUG });
            const client = await globalDeleter(ctx);

            const deleted = await client.api.groups[":slug"].$delete({
                param: { slug: HS_GROUP_SLUG },
                query: { confirm: HS_GROUP_SLUG },
            });

            expect(deleted.status).toBe(400);
            expect(await groupExists(ctx, HS_GROUP_SLUG)).toBe(true);
        },
        500_000,
    );

    for (const type of ["study", "studyyear"]) {
        integrationTest(
            `not even groups:delete can delete a ${type} group`,
            async ({ ctx }) => {
                const group = await ctx.utils.createTestGroup({
                    slug: `feide-${type}`,
                    type,
                });
                const client = await globalDeleter(ctx);

                const deleted = await client.api.groups[":slug"].$delete({
                    param: { slug: group.slug },
                    query: { confirm: group.slug },
                });

                expect(deleted.status).toBe(400);
                expect(await groupExists(ctx, group.slug)).toBe(true);
            },
            500_000,
        );
    }

    integrationTest(
        "not even groups:delete can delete a programme's own group",
        async ({ ctx }) => {
            const group = await ctx.utils.createTestGroup({
                slug: "programgruppe",
            });
            const [program] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "testprogram",
                    displayName: "Testprogram",
                    feideCode: "TESTPROGRAM",
                    type: "bachelor",
                })
                .returning({ id: schema.studyProgram.id });
            await ctx.db
                .update(schema.group)
                .set({ studyProgramId: program?.id })
                .where(eq(schema.group.slug, group.slug));
            const client = await globalDeleter(ctx);

            const deleted = await client.api.groups[":slug"].$delete({
                param: { slug: group.slug },
                query: { confirm: group.slug },
            });

            expect(deleted.status).toBe(400);
            expect(await groupExists(ctx, group.slug)).toBe(true);
        },
        500_000,
    );
});
