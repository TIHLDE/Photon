import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Replacing a picture has to release the one it replaced.
 *
 * Events, news, job postings and group deletion are covered by
 * `orphan-cleanup.test.ts` and `event/image-cleanup.test.ts`; this is the rest
 * of the surface — the album cover, the profile picture, and a group update
 * that swaps the picture while leaving the logo alone.
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
    return Promise.all(keys.map((key) => ctx.bucket.exists(key)));
}

describe("replacing a picture releases the old one", () => {
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
});
