import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { claimAttachments } from "~/lib/application/service";
import { assetKeyFromUrl } from "~/lib/asset";
import { clearMemberReadableCache } from "~/lib/asset/member-readable";
import { createApiKeyService } from "~/lib/service/api-key";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const BYTES = Buffer.from("bildebytes");

let counter = 0;

async function storeAsset(
    ctx: IntegrationTestContext,
    options: {
        uploadedById?: string;
        visibility?: "public" | "private";
        prefix?: string;
    } = {},
): Promise<{ key: string; url: string }> {
    const key = `${options.prefix ?? "uploads"}/2026/11/ownership-${counter++}.webp`;
    await ctx.bucket.upload(key, BYTES, {
        originalFilename: "bilde.webp",
        contentType: "image/webp",
        uploadedById: options.uploadedById,
        visibility: options.visibility ?? "public",
    });
    return { key, url: `https://photon.tihlde.org/api/assets/${key}` };
}

async function readAs(
    ctx: IntegrationTestContext,
    user: Parameters<IntegrationTestContext["utils"]["clientForUser"]>[0],
    key: string,
): Promise<number> {
    const client = await ctx.utils.clientForUser(user);
    const response = await client.api.assets[":key{.+}"].$get({
        param: { key },
    });
    return response.status;
}

describe("a profile picture must be the member's own", () => {
    integrationTest(
        "pointing an avatar at someone else's public image is refused and leaves it public",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(attacker);

            const image = await storeAsset(ctx, { uploadedById: owner.id });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: image.url },
            });
            expect(response.status).toBe(403);

            const asset = await ctx.bucket.getAsset(image.key);
            expect(asset?.visibility).toBe("public");
            expect(
                (await ctx.app.request(`/api/assets/${image.key}`)).status,
            ).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "a member cannot read a private asset by pointing an avatar at it",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(attacker);

            const attachment = await storeAsset(ctx, {
                uploadedById: owner.id,
                visibility: "private",
            });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: attachment.url },
            });
            expect(response.status).toBe(403);
            expect(await readAs(ctx, attacker, attachment.key)).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a member cannot delete someone else's unreferenced upload by setting and clearing an avatar",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(attacker);

            // An external app keeps this URL in its own database, so no row
            // here protects it.
            const external = await storeAsset(ctx, { uploadedById: owner.id });
            await ctx.bucket.promoteAsset(external.key);

            await client.api.user.me.settings.$patch({
                json: { imageUrl: external.url },
            });
            await client.api.user.me.settings.$patch({
                json: { imageUrl: "" },
            });

            expect(await ctx.bucket.exists(external.key)).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "onboarding follows the same rule",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(attacker);

            const image = await storeAsset(ctx, { uploadedById: owner.id });

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "other",
                    allowsPhotosByDefault: true,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: [],
                    imageUrl: image.url,
                },
            });
            expect(response.status).toBe(403);

            const asset = await ctx.bucket.getAsset(image.key);
            expect(asset?.visibility).toBe("public");
        },
        500_000,
    );

    integrationTest(
        "an own upload works, and saving the avatar again is not refused",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const image = await storeAsset(ctx, { uploadedById: user.id });

            for (let attempt = 0; attempt < 2; attempt++) {
                const response = await client.api.user.me.settings.$patch({
                    json: { imageUrl: image.url },
                });
                expect(response.status).toBe(200);
            }

            const asset = await ctx.bucket.getAsset(image.key);
            expect(asset?.visibility).toBe("private");
            expect(asset?.status).toBe("ready");
        },
        500_000,
    );

    integrationTest(
        "a migrated avatar with no known uploader can be saved again",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const migrated = await storeAsset(ctx, { visibility: "private" });
            await ctx.db.insert(schema.userSettings).values({
                userId: user.id,
                imageUrl: migrated.url,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: migrated.url, bioDescription: "Hei" },
            });
            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "a URL pointing at no asset is refused the same way as someone else's",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$patch({
                json: {
                    imageUrl:
                        "https://photon.tihlde.org/api/assets/uploads/2026/11/finnes-ikke.webp",
                },
            });
            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "an external image needs no asset at all",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: "https://images.example.com/meg.png" },
            });
            expect(response.status).toBe(200);
        },
        500_000,
    );
});

describe("a stored value that only looks like an asset grants nothing", () => {
    for (const shape of [
        (key: string) => `https://example.com/?a=/api/assets/${key}`,
        (key: string) => `https://example.com/#/api/assets/${key}`,
    ]) {
        integrationTest(
            `an avatar shaped like ${shape("<key>")} does not open a private asset`,
            async ({ ctx }) => {
                const owner = await ctx.utils.createTestUser();
                const attacker = await ctx.utils.createTestUser();
                const client = await ctx.utils.clientForUser(attacker);

                const attachment = await storeAsset(ctx, {
                    uploadedById: owner.id,
                    visibility: "private",
                });
                const disguised = shape(attachment.key);
                expect(assetKeyFromUrl(disguised)).toBeNull();

                await client.api.user.me.settings.$patch({
                    json: { imageUrl: disguised },
                });

                expect(await readAs(ctx, attacker, attachment.key)).toBe(404);
            },
            500_000,
        );
    }

    integrationTest(
        "a row nesting one asset path inside another does not open a private asset",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();

            const attachment = await storeAsset(ctx, {
                uploadedById: owner.id,
                visibility: "private",
            });

            await ctx.db.insert(schema.userSettings).values({
                userId: attacker.id,
                imageUrl: `https://example.com/api/assets/x/api/assets/${attachment.key}`,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });

            expect(await readAs(ctx, attacker, attachment.key)).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a decoy row does not hide the real one",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();
            const reader = await ctx.utils.createTestUser();

            const avatar = await storeAsset(ctx, {
                uploadedById: member.id,
                visibility: "private",
            });

            await ctx.db.insert(schema.userSettings).values([
                {
                    userId: other.id,
                    imageUrl: `https://example.com/?a=/api/assets/${avatar.key}`,
                    gender: "other",
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                },
                {
                    userId: member.id,
                    imageUrl: avatar.url,
                    gender: "other",
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                },
            ]);

            expect(await readAs(ctx, reader, avatar.key)).toBe(200);
        },
        500_000,
    );
});

describe("an avatar row only opens the member's own picture", () => {
    integrationTest(
        "auth_user.image set over Better Auth's own route does not open a private asset",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();

            const attachment = await storeAsset(ctx, {
                uploadedById: owner.id,
                visibility: "private",
            });

            const signIn = await ctx.auth.api.signInEmail({
                body: { email: attacker.email, password: attacker.password },
                returnHeaders: true,
            });
            const cookie = signIn.headers.getSetCookie()[0]?.split(";")[0];

            await ctx.app.request("/api/auth/update-user", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: cookie ?? "",
                },
                body: JSON.stringify({ image: attachment.url }),
            });

            expect(await readAs(ctx, attacker, attachment.key)).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a row saved before uploads were checked no longer opens someone else's file",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();

            const attachment = await storeAsset(ctx, {
                uploadedById: owner.id,
                visibility: "private",
            });

            await ctx.db.insert(schema.userSettings).values({
                userId: attacker.id,
                imageUrl: attachment.url,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });
            await ctx.db
                .update(schema.user)
                .set({ image: attachment.url })
                .where(eq(schema.user.id, attacker.id));

            expect(await readAs(ctx, attacker, attachment.key)).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "an avatar imported without an uploader stays readable by other members",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const reader = await ctx.utils.createTestUser();

            const imported = await storeAsset(ctx, {
                visibility: "private",
                prefix: "profile-images",
            });
            await ctx.db
                .update(schema.user)
                .set({ image: imported.url })
                .where(eq(schema.user.id, member.id));

            expect(await readAs(ctx, reader, imported.key)).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "auth_user.image does not open the file of a deleted member",
        async ({ ctx }) => {
            const attacker = await ctx.utils.createTestUser();

            const orphaned = await storeAsset(ctx, { visibility: "private" });
            await ctx.db
                .update(schema.user)
                .set({ image: orphaned.url })
                .where(eq(schema.user.id, attacker.id));

            expect(await readAs(ctx, attacker, orphaned.key)).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a settings avatar whose uploader is gone, as after merging accounts, stays readable",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const reader = await ctx.utils.createTestUser();

            const avatar = await storeAsset(ctx, { visibility: "private" });
            await ctx.db.insert(schema.userSettings).values({
                userId: member.id,
                imageUrl: avatar.url,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });

            expect(await readAs(ctx, reader, avatar.key)).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "clearing an avatar saved before uploads were checked leaves the other member's file",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const attacker = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(attacker);

            const external = await storeAsset(ctx, { uploadedById: owner.id });
            await ctx.db.insert(schema.userSettings).values({
                userId: attacker.id,
                imageUrl: external.url,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: "" },
            });
            expect(response.status).toBe(200);
            expect(await ctx.bucket.exists(external.key)).toBe(true);
        },
        500_000,
    );
});

describe("an asset URL must be in its plain form", () => {
    integrationTest(
        "adding a query to a saved picture is refused, so the file is not deleted under the row",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const image = await storeAsset(ctx, { uploadedById: user.id });
            await client.api.user.me.settings.$patch({
                json: { imageUrl: image.url },
            });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: `${image.url}?v=1` },
            });
            expect(response.status).toBe(403);
            expect(await ctx.bucket.exists(image.key)).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "a row already holding that form can still be saved unchanged",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const image = await storeAsset(ctx, { uploadedById: user.id });
            const stored = `${image.url}?v=1`;
            await ctx.db.insert(schema.userSettings).values({
                userId: user.id,
                imageUrl: stored,
                gender: "other",
                acceptsEventRules: true,
                receiveMailCommunication: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: stored },
            });
            expect(response.status).toBe(200);
            expect(await ctx.bucket.exists(image.key)).toBe(true);
        },
        500_000,
    );
});

describe("member-readable answers expire", () => {
    integrationTest(
        "a private asset stops being readable shortly after the row is gone",
        async ({ ctx }) => {
            clearMemberReadableCache();

            const user = await ctx.utils.createTestUser();
            const picture = await storeAsset(ctx, {
                uploadedById: user.id,
                visibility: "private",
            });

            const [album] = await ctx.db
                .insert(schema.galleryAlbum)
                .values({ slug: "utloper", title: "Utløper" })
                .returning();
            const [row] = await ctx.db
                .insert(schema.galleryPicture)
                .values({ albumId: album!.id, imageUrl: picture.url })
                .returning();

            expect(await readAs(ctx, user, picture.key)).toBe(200);

            await ctx.db
                .delete(schema.galleryPicture)
                .where(eq(schema.galleryPicture.id, row!.id));

            const now = Date.now();
            const clock = vi
                .spyOn(Date, "now")
                .mockReturnValue(now + 10 * 60 * 1000);
            try {
                expect(await readAs(ctx, user, picture.key)).toBe(404);
            } finally {
                clock.mockRestore();
            }
        },
        500_000,
    );
});

describe("application attachments", () => {
    integrationTest(
        "claiming an attachment uploaded as public makes it private",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const attachment = await storeAsset(ctx, {
                uploadedById: user.id,
                visibility: "public",
            });

            const result = await claimAttachments(
                ctx,
                [attachment.key],
                user.id,
            );
            expect(result).toEqual({ ok: true });

            const asset = await ctx.bucket.getAsset(attachment.key);
            expect(asset?.visibility).toBe("private");
            expect(asset?.status).toBe("ready");
            expect(
                (await ctx.app.request(`/api/assets/${attachment.key}`)).status,
            ).toBe(404);
        },
        500_000,
    );
});

describe("rows shared by several editors", () => {
    integrationTest(
        "an editor may keep a picture another editor uploaded, and is refused a new one that is not theirs",
        async ({ ctx }) => {
            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();
            const stranger = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(first, ["groups:update"]);
            await ctx.utils.giveUserPermissions(second, ["groups:update"]);

            const group = await ctx.utils.createTestGroup({
                slug: "shared-editors",
            });
            const firstClient = await ctx.utils.clientForUser(first);
            const secondClient = await ctx.utils.clientForUser(second);

            const image = await storeAsset(ctx, { uploadedById: first.id });
            const foreign = await storeAsset(ctx, {
                uploadedById: stranger.id,
            });

            const set = await firstClient.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { imageUrl: image.url },
            });
            expect(set.status).toBe(200);

            const kept = await secondClient.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { imageUrl: image.url, description: "Ny tekst" },
            });
            expect(kept.status).toBe(200);

            // Picture moved to the logo slot on the same row.
            const moved = await secondClient.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { logoUrl: image.url },
            });
            expect(moved.status).toBe(200);

            const refused = await secondClient.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: { imageUrl: foreign.url },
            });
            expect(refused.status).toBe(403);
            expect(await ctx.bucket.exists(foreign.key)).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "a gallery manager cannot open a private asset by adding it to an album",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const manager = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(manager, ["galleries:manage"]);
            const client = await ctx.utils.clientForUser(manager);

            const attachment = await storeAsset(ctx, {
                uploadedById: owner.id,
                visibility: "private",
            });
            const [album] = await ctx.db
                .insert(schema.galleryAlbum)
                .values({ slug: "ikke-ditt", title: "Ikke ditt" })
                .returning();

            const response = await client.api.galleries[":slug"].pictures.$post(
                {
                    param: { slug: album!.slug },
                    json: { pictures: [{ imageUrl: attachment.url }] },
                },
            );
            expect(response.status).toBe(403);
            expect(await readAs(ctx, manager, attachment.key)).toBe(404);
        },
        500_000,
    );
});

describe("promoting through the shared rule", () => {
    integrationTest(
        "an API key promotes what it uploaded, and only that",
        async ({ ctx }) => {
            const creator = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();
            const { key: apiKey } = await createApiKeyService(ctx).create({
                name: "Ekstern app",
                description: "Laster opp bilder",
                permissions: [],
                createdById: creator.id,
            });

            const own = await storeAsset(ctx, { uploadedById: creator.id });
            const foreign = await storeAsset(ctx, { uploadedById: other.id });

            const promote = (key: string) =>
                ctx.app.request(`/api/assets/promote/${key}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${apiKey}` },
                });

            expect((await promote(own.key)).status).toBe(200);
            expect((await ctx.bucket.getAsset(own.key))?.status).toBe("ready");

            expect((await promote(foreign.key)).status).toBe(403);
        },
        500_000,
    );
});
