import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

async function uploadImage(
    ctx: IntegrationTestContext,
    key: string,
    userId: string,
): Promise<string> {
    await ctx.bucket.upload(key, Buffer.from("image bytes"), {
        originalFilename: "image.png",
        contentType: "image/png",
        uploadedById: userId,
    });
    return `https://photon.test/api/assets/${key}`;
}

describe("images are deleted with the row that used them", () => {
    integrationTest(
        "deleting an event deletes its image",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:delete",
            ]);

            const key = "uploads/2026/01/deleted-event.png";
            const imageUrl = await uploadImage(ctx, key, user.id);

            const created = await client.api.event.$post({
                json: {
                    title: "Event to delete",
                    description: "Has an image",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Trondheim",
                    imageUrl,
                    start: "2025-12-01T18:00:00Z",
                    end: "2025-12-01T20:00:00Z",
                    registrationStart: null,
                    registrationEnd: "2025-11-30T23:59:59Z",
                    cancellationDeadline: null,
                    capacity: 50,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            const deleted = await client.api.event[":eventId"].$delete({
                param: { eventId },
            });
            expect(deleted.status).toBe(200);

            expect(await ctx.bucket.exists(key)).toBe(false);
            expect(await ctx.bucket.getAsset(key)).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "news: the image goes when it is replaced and when the article is deleted",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["news:manage"]);

            const firstKey = "uploads/2026/01/news-first.png";
            const secondKey = "uploads/2026/01/news-second.png";
            const firstUrl = await uploadImage(ctx, firstKey, user.id);
            const secondUrl = await uploadImage(ctx, secondKey, user.id);

            const created = await client.api.news.$post({
                json: {
                    title: "News with image",
                    header: "Header",
                    body: "Body",
                    imageUrl: firstUrl,
                    emojisAllowed: true,
                },
            });
            expect(created.status).toBe(201);
            const { id } = await created.json();

            const updated = await client.api.news[":id"].$patch({
                param: { id },
                json: { imageUrl: secondUrl },
            });
            expect(updated.status).toBe(200);
            expect(await ctx.bucket.exists(firstKey)).toBe(false);
            expect(await ctx.bucket.exists(secondKey)).toBe(true);

            const deleted = await client.api.news[":id"].$delete({
                param: { id },
            });
            expect(deleted.status).toBe(200);
            expect(await ctx.bucket.exists(secondKey)).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "jobs: the image goes when it is removed and when the posting is deleted",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["jobs:manage"]);

            const key = "uploads/2026/01/job.png";
            const imageUrl = await uploadImage(ctx, key, user.id);

            const created = await client.api.jobs.$post({
                json: {
                    title: "Developer",
                    ingress: "Ingress",
                    body: "Body",
                    company: "Tech Corp",
                    location: "Trondheim",
                    deadline: new Date(
                        Date.now() + 30 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    isContinuouslyHiring: false,
                    jobType: "full_time",
                    email: "hr@techcorp.com",
                    link: "https://techcorp.com/careers",
                    classStart: "third",
                    classEnd: "fifth",
                    imageUrl,
                },
            });
            expect(created.status).toBe(201);
            const { id } = await created.json();

            const cleared = await client.api.jobs[":id"].$patch({
                param: { id },
                json: { imageUrl: null },
            });
            expect(cleared.status).toBe(200);
            expect(await ctx.bucket.exists(key)).toBe(false);

            const deleted = await client.api.jobs[":id"].$delete({
                param: { id },
            });
            expect(deleted.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "groups: image and logo go when the group is deleted",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, [
                "groups:create",
                "groups:update",
                "groups:delete",
            ]);

            const imageKey = "uploads/2026/01/group-image.png";
            const logoKey = "uploads/2026/01/group-logo.png";
            const replacedLogoKey = "uploads/2026/01/group-logo-old.png";
            const imageUrl = await uploadImage(ctx, imageKey, user.id);
            const logoUrl = await uploadImage(ctx, logoKey, user.id);
            const replacedLogoUrl = await uploadImage(
                ctx,
                replacedLogoKey,
                user.id,
            );

            const created = await client.api.groups.$post({
                json: {
                    slug: "image-committee",
                    name: "Image Committee",
                    description: "Has pictures",
                    contactEmail: "contact@committee.org",
                    type: "committee",
                    finesInfo: "",
                    finesActivated: false,
                    imageUrl,
                    logoUrl: replacedLogoUrl,
                },
            });
            expect(created.status).toBe(201);

            const updated = await client.api.groups[":slug"].$patch({
                param: { slug: "image-committee" },
                json: { logoUrl },
            });
            expect(updated.status).toBe(200);
            expect(await ctx.bucket.exists(replacedLogoKey)).toBe(false);

            const deleted = await client.api.groups[":slug"].$delete({
                param: { slug: "image-committee" },
            });
            expect(deleted.status).toBe(204);

            expect(await ctx.bucket.exists(imageKey)).toBe(false);
            expect(await ctx.bucket.exists(logoKey)).toBe(false);
        },
        500_000,
    );
});
