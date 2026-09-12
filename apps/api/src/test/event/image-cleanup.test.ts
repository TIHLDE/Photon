import { describe, expect } from "vitest";
import { imageVariantKey } from "~/lib/asset/image";
import { integrationTest } from "~/test/config/integration";

const baseEventBody = {
    title: "Image Cleanup Event",
    description: "Event for testing image deletion",
    categorySlug: "bedpres",
    organizerGroupSlug: "index",
    location: "Trondheim",
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
};

describe("event image cleanup", () => {
    integrationTest(
        "removing the image deletes the file and its cached variants",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const key = "uploads/2026/01/removed_image.png";
            await ctx.bucket.upload(key, Buffer.from("image bytes"), {
                originalFilename: "image.png",
                contentType: "image/png",
                uploadedById: user.id,
            });
            const variantKey = imageVariantKey(key, 640);
            await ctx.bucket.putObject(
                variantKey,
                Buffer.from("variant bytes"),
                "image/webp",
            );

            const createResponse = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    imageUrl: `https://photon.test/api/assets/${key}`,
                },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const updateResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { imageUrl: null },
            });
            expect(updateResponse.status).toBe(200);

            expect(await ctx.bucket.exists(key)).toBe(false);
            expect(await ctx.bucket.getAsset(key)).toBeNull();
            expect(await ctx.bucket.getObject(variantKey)).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "an image another event still uses is kept",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const key = "uploads/2026/01/shared_image.png";
            await ctx.bucket.upload(key, Buffer.from("image bytes"), {
                originalFilename: "image.png",
                contentType: "image/png",
                uploadedById: user.id,
            });
            const imageUrl = `https://photon.test/api/assets/${key}`;

            const first = await client.api.event.$post({
                json: { ...baseEventBody, imageUrl },
            });
            expect(first.status).toBe(201);
            const second = await client.api.event.$post({
                json: { ...baseEventBody, title: "Sharer", imageUrl },
            });
            expect(second.status).toBe(201);

            const { eventId } = await first.json();
            const updateResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { imageUrl: null },
            });
            expect(updateResponse.status).toBe(200);

            expect(await ctx.bucket.exists(key)).toBe(true);
            expect(await ctx.bucket.getAsset(key)).not.toBeNull();
        },
        500_000,
    );
    integrationTest(
        "an update that does not touch the image keeps the file",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const key = "uploads/2026/01/untouched_image.png";
            await ctx.bucket.upload(key, Buffer.from("image bytes"), {
                originalFilename: "image.png",
                contentType: "image/png",
                uploadedById: user.id,
            });

            const createResponse = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    imageUrl: `https://photon.test/api/assets/${key}`,
                },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const updateResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { title: "Renamed event" },
            });
            expect(updateResponse.status).toBe(200);

            expect(await ctx.bucket.exists(key)).toBe(true);
            expect(await ctx.bucket.getAsset(key)).not.toBeNull();
        },
        500_000,
    );
});
