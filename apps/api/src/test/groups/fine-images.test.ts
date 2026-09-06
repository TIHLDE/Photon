import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { removeUserFromGroup } from "~/lib/group";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const PICTURE = Buffer.from("bevis-for-boten");

async function setupFine(
    ctx: IntegrationTestContext,
    options: { slug: string },
) {
    const giver = await ctx.utils.createTestUser();
    const group = await ctx.utils.createTestGroup({
        slug: options.slug,
        finesActivated: true,
    });

    const fined = await ctx.utils.createTestUser(
        `fined-${options.slug}@test.com`,
    );

    await ctx.db.insert(schema.groupMembership).values([
        { userId: giver.id, groupSlug: group.slug, role: "leader" },
        { userId: fined.id, groupSlug: group.slug },
    ]);

    const key = `uploads/2026/09/${options.slug}-evidence.webp`;
    await ctx.bucket.upload(key, PICTURE, {
        originalFilename: "evidence.webp",
        contentType: "image/webp",
        uploadedById: giver.id,
        visibility: "private",
    });

    const image = `https://photon.tihlde.org/api/assets/${key}`;
    const [fine] = await ctx.db
        .insert(schema.fine)
        .values({
            userId: fined.id,
            groupSlug: group.slug,
            createdByUserId: giver.id,
            reason: "Late to meeting",
            amount: 1,
            image,
            status: "pending",
        })
        .returning();

    if (!fine) throw new Error("Failed to create test fine");

    return { giver, group, fined, fine, key, image };
}

describe("fine images", () => {
    integrationTest(
        "the fined member reads their own picture, and keeps it after leaving the group",
        async ({ ctx }) => {
            const { group, fine, fined } = await setupFine(ctx, {
                slug: "fine-image-owner",
            });

            const client = await ctx.utils.clientForUser(fined);

            const response = await client.api.groups[":groupSlug"].fines[
                ":fineId"
            ].image.$get({
                param: { groupSlug: group.slug, fineId: fine.id },
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("image/webp");
            expect(response.headers.get("Cache-Control")).toBe(
                "private, no-store",
            );
            expect(Buffer.from(await response.arrayBuffer())).toEqual(PICTURE);

            await removeUserFromGroup(ctx, fined.id, group.slug);

            const afterLeaving = await client.api.groups[":groupSlug"].fines[
                ":fineId"
            ].image.$get({
                param: { groupSlug: group.slug, fineId: fine.id },
            });

            expect(afterLeaving.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "any member of the group reads it",
        async ({ ctx }) => {
            const { group, fine } = await setupFine(ctx, {
                slug: "fine-image-member",
            });

            const member = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: group.slug,
            });

            const client = await ctx.utils.clientForUser(member);
            const response = await client.api.groups[":groupSlug"].fines[
                ":fineId"
            ].image.$get({
                param: { groupSlug: group.slug, fineId: fine.id },
            });

            expect(response.status).toBe(200);
            expect(Buffer.from(await response.arrayBuffer())).toEqual(PICTURE);
        },
        500_000,
    );

    integrationTest(
        "a signed-in outsider gets 404, not 403",
        async ({ ctx }) => {
            const { group, fine } = await setupFine(ctx, {
                slug: "fine-image-outsider",
            });

            const outsider = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(outsider);

            const response = await client.api.groups[":groupSlug"].fines[
                ":fineId"
            ].image.$get({
                param: { groupSlug: group.slug, fineId: fine.id },
            });

            expect(response.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a signed-out caller gets 404",
        async ({ ctx }) => {
            const { group, fine } = await setupFine(ctx, {
                slug: "fine-image-anonymous",
            });

            const response = await ctx.app.request(
                `/api/groups/${group.slug}/fines/${fine.id}/image`,
            );

            expect(response.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "the open asset routes refuse a private picture",
        async ({ ctx }) => {
            const { key } = await setupFine(ctx, {
                slug: "fine-image-open-route",
            });

            const download = await ctx.app.request(`/api/assets/${key}`);
            expect(download.status).toBe(404);

            const metadata = await ctx.app.request(
                `/api/assets/metadata/${key}`,
            );
            expect(metadata.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "creating a fine makes its picture private, whatever the client asked for",
        async ({ ctx }) => {
            const giver = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(giver);

            const group = await ctx.utils.createTestGroup({
                slug: "fine-image-claim",
                finesActivated: true,
            });

            const target = await ctx.auth.api.createUser({
                body: {
                    email: "claim-target@test.com",
                    name: "Claim Target",
                    password: "test123!",
                },
            });

            await ctx.db.insert(schema.groupMembership).values([
                { userId: giver.id, groupSlug: group.slug, role: "leader" },
                { userId: target.user.id, groupSlug: group.slug },
            ]);

            // Lastet opp som offentlig, slik alle andre bilder i Photon er.
            const key = "uploads/2026/09/claimed-evidence.webp";
            await ctx.bucket.upload(key, PICTURE, {
                originalFilename: "evidence.webp",
                contentType: "image/webp",
                uploadedById: giver.id,
            });

            const response = await client.api.groups[":groupSlug"].fines.$post({
                param: { groupSlug: group.slug },
                json: {
                    userId: target.user.id,
                    groupSlug: group.slug,
                    reason: "Late to meeting",
                    amount: 1,
                    image: `https://photon.tihlde.org/api/assets/${key}`,
                },
            });

            expect(response.status).toBe(201);

            const asset = await ctx.db.query.asset.findFirst({
                where: eq(schema.asset.key, key),
            });

            expect(asset?.visibility).toBe("private");
            expect(asset?.status).toBe("ready");

            const download = await ctx.app.request(`/api/assets/${key}`);
            expect(download.status).toBe(404);
        },
        500_000,
    );
});
