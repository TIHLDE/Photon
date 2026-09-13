import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Every route that lets someone swap a picture has to release the one it
 * replaced.
 *
 * The file is promoted the moment a row claims it, which puts it out of reach
 * of the staged-asset cleanup for good — so a replaced picture used to sit in
 * the bucket forever. Seven copies of the same banner, uploaded within a
 * minute and a half while someone saved an event over and over, is what this
 * looked like in production.
 */

const PIXEL = Buffer.from("bilde");

let counter = 0;

async function uploadImage(ctx: IntegrationTestContext): Promise<{
    key: string;
    url: string;
}> {
    const key = `uploads/2026/09/replaced-${counter++}.webp`;
    await ctx.bucket.upload(key, PIXEL, {
        originalFilename: "bilde.webp",
        contentType: "image/webp",
    });

    return { key, url: `https://photon.tihlde.org/api/assets/${key}` };
}

async function bothStates(ctx: IntegrationTestContext, keys: string[]) {
    await ctx.utils.runAssetReleases();
    return Promise.all(keys.map((key) => ctx.bucket.exists(key)));
}

describe("replacing a picture releases the old one", () => {
    integrationTest(
        "event",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const first = await uploadImage(ctx);
            const second = await uploadImage(ctx);

            const created = await client.api.event.$post({
                json: {
                    title: "Diskgolf",
                    description: "Banner byttes",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Trondheim",
                    imageUrl: first.url,
                    start: "2026-12-01T18:00:00Z",
                    end: "2026-12-01T20:00:00Z",
                    registrationStart: null,
                    registrationEnd: "2026-11-30T23:59:59Z",
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

            const updated = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { imageUrl: second.url },
            });
            expect(updated.status).toBe(200);

            expect(await bothStates(ctx, [first.key, second.key])).toEqual([
                false,
                true,
            ]);
        },
        500_000,
    );

    integrationTest(
        "news",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, [
                "news:create",
                "news:update",
            ]);

            const first = await uploadImage(ctx);
            const second = await uploadImage(ctx);

            const created = await client.api.news.$post({
                json: {
                    title: "Nyhet",
                    header: "Header",
                    body: "Innhold",
                    imageUrl: first.url,
                    emojisAllowed: true,
                },
            });
            expect(created.status).toBe(201);
            const article = await created.json();

            const updated = await client.api.news[":id"].$patch({
                param: { id: String(article.id) },
                json: { imageUrl: second.url },
            });
            expect(updated.status).toBe(200);

            expect(await bothStates(ctx, [first.key, second.key])).toEqual([
                false,
                true,
            ]);
        },
        500_000,
    );

    integrationTest(
        "job posting",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["jobs:manage"]);

            const first = await uploadImage(ctx);
            const second = await uploadImage(ctx);

            const created = await client.api.jobs.$post({
                json: {
                    title: "Utvikler",
                    ingress: "Bli med",
                    body: "Beskrivelse",
                    company: "Bedrift",
                    location: "Trondheim",
                    deadline: "2026-12-01T12:00:00Z",
                    jobType: "full_time",
                    email: "jobb@example.com",
                    imageUrl: first.url,
                },
            });
            expect(created.status).toBe(201);
            const job = await created.json();

            const updated = await client.api.jobs[":id"].$patch({
                param: { id: String(job.id) },
                json: { imageUrl: second.url },
            });
            expect(updated.status).toBe(200);

            expect(await bothStates(ctx, [first.key, second.key])).toEqual([
                false,
                true,
            ]);
        },
        500_000,
    );

    integrationTest(
        "group picture and logo, independently",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["groups:update"]);

            const group = await ctx.utils.createTestGroup({
                slug: "replaced-group",
            });

            const image = await uploadImage(ctx);
            const logo = await uploadImage(ctx);
            const newImage = await uploadImage(ctx);

            const first = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { imageUrl: image.url, logoUrl: logo.url },
            });
            expect(first.status).toBe(200);

            // Only the picture is replaced; the logo is not in the body at all
            // and must survive untouched.
            const second = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { imageUrl: newImage.url },
            });
            expect(second.status).toBe(200);

            expect(
                await bothStates(ctx, [image.key, logo.key, newImage.key]),
            ).toEqual([false, true, true]);
        },
        500_000,
    );

    integrationTest(
        "gallery album cover",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, ["galleries:manage"]);

            const first = await uploadImage(ctx);
            const second = await uploadImage(ctx);

            const created = await client.api.galleries.$post({
                json: {
                    title: "Album",
                    description: "Bilder",
                    imageUrl: first.url,
                },
            });
            expect(created.status).toBe(201);
            const album = await created.json();

            const updated = await client.api.galleries[":slug"].$patch({
                param: { slug: album.slug },
                json: { imageUrl: second.url },
            });
            expect(updated.status).toBe(200);

            expect(await bothStates(ctx, [first.key, second.key])).toEqual([
                false,
                true,
            ]);
        },
        500_000,
    );

    integrationTest(
        "profile picture",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const first = await uploadImage(ctx);
            const second = await uploadImage(ctx);

            const set = await client.api.user.me.settings.$patch({
                json: { imageUrl: first.url },
            });
            expect(set.status).toBe(200);

            const replaced = await client.api.user.me.settings.$patch({
                json: { imageUrl: second.url },
            });
            expect(replaced.status).toBe(200);

            expect(await bothStates(ctx, [first.key, second.key])).toEqual([
                false,
                true,
            ]);
        },
        500_000,
    );

    integrationTest(
        "an update that does not mention the picture leaves it alone",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            await ctx.utils.giveUserPermissions(user, [
                "news:create",
                "news:update",
            ]);

            const image = await uploadImage(ctx);

            const created = await client.api.news.$post({
                json: {
                    title: "Nyhet",
                    header: "Header",
                    body: "Innhold",
                    imageUrl: image.url,
                    emojisAllowed: true,
                },
            });
            const article = await created.json();

            const updated = await client.api.news[":id"].$patch({
                param: { id: String(article.id) },
                json: { title: "Ny tittel" },
            });
            expect(updated.status).toBe(200);

            expect(await bothStates(ctx, [image.key])).toEqual([true]);
        },
        500_000,
    );
});
