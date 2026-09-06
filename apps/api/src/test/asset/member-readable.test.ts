import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const BYTES = Buffer.from("bildebytes");

async function storeAsset(
    ctx: IntegrationTestContext,
    key: string,
    visibility: "public" | "private",
) {
    await ctx.bucket.upload(key, BYTES, {
        originalFilename: "bilde.webp",
        contentType: "image/webp",
        visibility,
    });
    return `https://photon.tihlde.org/api/assets/${key}`;
}

describe("assets that require a session", () => {
    integrationTest(
        "a gallery picture is refused when signed out and served when signed in",
        async ({ ctx }) => {
            const key = "uploads/2026/09/album-picture.webp";
            const url = await storeAsset(ctx, key, "private");

            const [album] = await ctx.db
                .insert(schema.galleryAlbum)
                .values({ slug: "hyttetur", title: "Hyttetur" })
                .returning();
            await ctx.db
                .insert(schema.galleryPicture)
                .values({ albumId: album!.id, imageUrl: url });

            const anonymous = await ctx.app.request(`/api/assets/${key}`);
            expect(anonymous.status).toBe(404);

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            const signedIn = await client.api.assets[":key{.+}"].$get({
                param: { key },
            });

            expect(signedIn.status).toBe(200);
            // Uten dette kan nginx eller en CDN servere bildet videre til noen
            // som ikke er logget inn.
            expect(signedIn.headers.get("Cache-Control")).toBe(
                "private, max-age=31536000, immutable",
            );
        },
        500_000,
    );

    integrationTest(
        "an album cover and an uploaded profile picture follow the same rule",
        async ({ ctx }) => {
            const coverKey = "uploads/2026/09/album-cover.webp";
            const avatarKey = "uploads/2026/09/avatar.webp";
            const coverUrl = await storeAsset(ctx, coverKey, "private");
            const avatarUrl = await storeAsset(ctx, avatarKey, "private");

            await ctx.db.insert(schema.galleryAlbum).values({
                slug: "julebord",
                title: "Julebord",
                imageUrl: coverUrl,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.userSettings).values({
                userId: user.id,
                imageUrl: avatarUrl,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });

            for (const key of [coverKey, avatarKey]) {
                expect(
                    (await ctx.app.request(`/api/assets/${key}`)).status,
                ).toBe(404);
            }

            const client = await ctx.utils.clientForUser(user);
            for (const key of [coverKey, avatarKey]) {
                const response = await client.api.assets[":key{.+}"].$get({
                    param: { key },
                });
                expect(response.status).toBe(200);
            }
        },
        500_000,
    );

    integrationTest(
        "a private asset nothing member-readable points at stays refused, signed in or not",
        async ({ ctx }) => {
            const key = "uploads/2026/09/kontraktsignatur.webp";
            await storeAsset(ctx, key, "private");

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            expect((await ctx.app.request(`/api/assets/${key}`)).status).toBe(
                404,
            );
            const signedIn = await client.api.assets[":key{.+}"].$get({
                param: { key },
            });
            expect(signedIn.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "public assets are untouched",
        async ({ ctx }) => {
            const key = "uploads/2026/09/nyhetsbilde.webp";
            await storeAsset(ctx, key, "public");

            const response = await ctx.app.request(`/api/assets/${key}`);
            expect(response.status).toBe(200);
            expect(response.headers.get("Cache-Control")).toBe(
                "public, max-age=31536000, immutable",
            );
        },
        500_000,
    );

    integrationTest(
        "metadata follows the download rule",
        async ({ ctx }) => {
            const key = "uploads/2026/09/metadata-picture.webp";
            const url = await storeAsset(ctx, key, "private");

            const [album] = await ctx.db
                .insert(schema.galleryAlbum)
                .values({ slug: "immatrikulering", title: "Immatrikulering" })
                .returning();
            await ctx.db
                .insert(schema.galleryPicture)
                .values({ albumId: album!.id, imageUrl: url });

            const anonymous = await ctx.app.request(
                `/api/assets/metadata/${key}`,
            );
            expect(anonymous.status).toBe(404);

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            const signedIn = await client.api.assets.metadata[":key{.+}"].$get({
                param: { key },
            });
            expect(signedIn.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "adding a picture to an album marks its asset as needing a session",
        async ({ ctx }) => {
            const key = "uploads/2026/09/opplastet-galleribilde.webp";
            const url = await storeAsset(ctx, key, "public");

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, ["galleries:manage"]);
            const client = await ctx.utils.clientForUser(user);

            const [album] = await ctx.db
                .insert(schema.galleryAlbum)
                .values({ slug: "fadderuka", title: "Fadderuka" })
                .returning();

            const response = await client.api.galleries[":slug"].pictures.$post(
                {
                    param: { slug: album!.slug },
                    json: { pictures: [{ imageUrl: url }] },
                },
            );
            expect(response.status).toBe(201);

            const asset = await ctx.db.query.asset.findFirst({
                where: eq(schema.asset.key, key),
            });
            expect(asset?.visibility).toBe("private");
            expect(asset?.status).toBe("ready");

            expect((await ctx.app.request(`/api/assets/${key}`)).status).toBe(
                404,
            );
        },
        500_000,
    );
});
