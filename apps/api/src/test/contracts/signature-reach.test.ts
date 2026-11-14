import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

async function setup(
    ctx: IntegrationTestContext,
    leaderPermissions: string[] = [],
) {
    const group = await ctx.utils.createTestGroup({ slug: "signaturgruppe" });
    const leader = await ctx.utils.createTestUser();
    const member = await ctx.utils.createTestUser("signerer@test.com");
    await ctx.db
        .update(schema.group)
        .set({ leaderPermissions })
        .where(eq(schema.group.slug, group.slug));
    await ctx.db.insert(schema.groupMembership).values([
        { userId: leader.id, groupSlug: group.slug, role: "leader" },
        { userId: member.id, groupSlug: group.slug },
    ]);

    const [contract] = await ctx.db
        .insert(schema.contract)
        .values({
            title: "Kontrakt",
            version: "2026-01",
            fileKey: "test/contract.pdf",
            isActive: true,
        })
        .returning();
    if (!contract) throw new Error("Contract was not created");

    await ctx.db.insert(schema.contractSignature).values({
        contractId: contract.id,
        userId: member.id,
        signedName: "Signert Medlem",
        signedPdfKey: "test/signed.pdf",
        signedPdfHash: "0".repeat(64),
        signatureFileKey: "test/signature.png",
    });

    return {
        group,
        member,
        leaderClient: await ctx.utils.clientForUser(leader),
    };
}

describe("a contract signature belongs to the member", () => {
    integrationTest(
        "the group's leader cannot revoke it",
        async ({ ctx }) => {
            const { group, member, leaderClient } = await setup(ctx);

            const response = await leaderClient.api.contracts.groups[
                ":groupSlug"
            ].signatures[":userId"].$delete({
                param: { groupSlug: group.slug, userId: member.id },
            });

            expect(response.status).toBe(403);
            expect(
                await ctx.db.query.contractSignature.findFirst({
                    where: { userId: member.id },
                }),
            ).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "contracts:manage for only this group is not enough",
        async ({ ctx }) => {
            const { group, member, leaderClient } = await setup(ctx, [
                "contracts:manage",
            ]);

            const response = await leaderClient.api.contracts.groups[
                ":groupSlug"
            ].signatures[":userId"].$delete({
                param: { groupSlug: group.slug, userId: member.id },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "contracts:manage across TIHLDE can revoke it",
        async ({ ctx }) => {
            const { group, member } = await setup(ctx);
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["contracts:manage"]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const response = await adminClient.api.contracts.groups[
                ":groupSlug"
            ].signatures[":userId"].$delete({
                param: { groupSlug: group.slug, userId: member.id },
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "the signing status list no longer carries email addresses",
        async ({ ctx }) => {
            const { group, member, leaderClient } = await setup(ctx);

            const response = await leaderClient.api.contracts.groups[
                ":groupSlug"
            ].signatures.$get({ param: { groupSlug: group.slug } });

            expect(response.status).toBe(200);
            const body = await response.json();
            const row = body.members.find((m) => m.userId === member.id);
            expect(row?.hasSigned).toBe(true);
            expect(row).not.toHaveProperty("userEmail");
            expect(JSON.stringify(body)).not.toContain("signerer@test.com");
        },
        500_000,
    );
});
