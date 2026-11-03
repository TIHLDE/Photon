import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runAssetCleanup } from "~/lib/asset/worker";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const PLACEMENT = { page: 0, xPct: 0.16, yPct: 0.7, wPct: 0.35, hPct: 0.09 };

const VISIBLE_FROM = "2026-01-01T00:00:00.000Z";
const VISIBLE_UNTIL = "2026-12-31T00:00:00.000Z";

let counter = 0;

async function storeAsset(
    ctx: IntegrationTestContext,
    options: {
        uploadedById?: string;
        visibility?: "public" | "private";
    } = {},
): Promise<{ key: string; url: string }> {
    const key = `uploads/2026/11/routes-${counter++}.pdf`;
    await ctx.bucket.upload(key, Buffer.from("filbytes"), {
        originalFilename: "fil.pdf",
        contentType: "application/pdf",
        uploadedById: options.uploadedById,
        visibility: options.visibility ?? "public",
    });
    return { key, url: `https://photon.tihlde.org/api/assets/${key}` };
}

async function statusOf(ctx: IntegrationTestContext, key: string) {
    return (await ctx.bucket.getAsset(key))?.status;
}

async function ageAsset(ctx: IntegrationTestContext, key: string) {
    await ctx.db
        .update(schema.asset)
        .set({ createdAt: new Date("2020-01-01T00:00:00.000Z") })
        .where(eq(schema.asset.key, key));
}

describe("TÖDDEL only publishes the caller's own uploads", () => {
    integrationTest(
        "someone else's staged PDF is refused and stays staged",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const editor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(editor, ["toddel:manage"]);
            const client = await ctx.utils.clientForUser(editor);

            const file = await storeAsset(ctx, { uploadedById: owner.id });

            const response = await client.api.toddel.$post({
                json: {
                    edition: 501,
                    title: "Töddel",
                    publishedAt: "2026-07-01",
                    pdfKey: file.key,
                },
            });

            expect.soft(response.status).toBe(403);
            expect(await statusOf(ctx, file.key)).toBe("staged");
        },
        500_000,
    );

    integrationTest(
        "someone else's staged cover is refused on update",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const editor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(editor, ["toddel:manage"]);
            const client = await ctx.utils.clientForUser(editor);

            const pdf = await storeAsset(ctx, { uploadedById: editor.id });
            const created = await client.api.toddel.$post({
                json: {
                    edition: 502,
                    title: "Töddel",
                    publishedAt: "2026-07-01",
                    pdfKey: pdf.key,
                },
            });
            expect(created.status).toBe(201);

            const cover = await storeAsset(ctx, { uploadedById: owner.id });
            const response = await client.api.toddel[":edition"].$patch({
                param: { edition: "502" },
                json: { imageKey: cover.key },
            });

            expect.soft(response.status).toBe(403);
            expect(await statusOf(ctx, cover.key)).toBe("staged");
        },
        500_000,
    );

    integrationTest(
        "another editor can re-save a file the issue already holds",
        async ({ ctx }) => {
            const firstEditor = await ctx.utils.createTestUser();
            const nextEditor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(firstEditor, ["toddel:manage"]);
            await ctx.utils.giveUserPermissions(nextEditor, ["toddel:manage"]);

            const pdf = await storeAsset(ctx, { uploadedById: firstEditor.id });
            const firstClient = await ctx.utils.clientForUser(firstEditor);
            const created = await firstClient.api.toddel.$post({
                json: {
                    edition: 503,
                    title: "Töddel",
                    publishedAt: "2026-07-01",
                    pdfKey: pdf.key,
                },
            });
            expect(created.status).toBe(201);

            const nextClient = await ctx.utils.clientForUser(nextEditor);
            const response = await nextClient.api.toddel[":edition"].$patch({
                param: { edition: "503" },
                json: { title: "Revidert", pdfKey: pdf.key },
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );
});

describe("a contract is built from the caller's own PDF", () => {
    integrationTest(
        "someone else's private PDF cannot be registered and handed to signers",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, [
                "contracts:create",
                "contracts:update",
            ]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const secret = await storeAsset(ctx, {
                uploadedById: owner.id,
                visibility: "private",
            });

            const created = await adminClient.api.contracts.$post({
                json: {
                    title: "Kontrakt",
                    version: "1",
                    fileKey: secret.key,
                    signaturePlacement: PLACEMENT,
                },
            });
            expect(created.status).toBe(403);

            expect(await ctx.db.query.contract.findFirst()).toBeUndefined();
            expect(await statusOf(ctx, secret.key)).toBe("staged");
        },
        500_000,
    );

    integrationTest(
        "a key with no upload behind it is refused the same way",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["contracts:create"]);
            const client = await ctx.utils.clientForUser(admin);

            const response = await client.api.contracts.$post({
                json: {
                    title: "Kontrakt",
                    version: "1",
                    fileKey: "uploads/2026/11/finnes-ikke.pdf",
                },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );
});

describe("a banner link cannot keep someone else's upload alive", () => {
    integrationTest(
        "creating a banner with someone else's staged upload is refused and the file is cleaned up",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const editor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(editor, ["banners:manage"]);
            const client = await ctx.utils.clientForUser(editor);

            const file = await storeAsset(ctx, { uploadedById: owner.id });
            await ageAsset(ctx, file.key);

            const response = await client.api.banners.$post({
                json: {
                    title: "Banner",
                    description: "Tekst",
                    url: file.url,
                    visibleFrom: VISIBLE_FROM,
                    visibleUntil: VISIBLE_UNTIL,
                },
            });
            expect.soft(response.status).toBe(403);

            await runAssetCleanup(ctx);
            expect(await ctx.bucket.getAsset(file.key)).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "updating a banner to someone else's staged upload is refused",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const editor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(editor, ["banners:manage"]);
            const client = await ctx.utils.clientForUser(editor);

            const created = await client.api.banners.$post({
                json: {
                    title: "Banner",
                    description: "Tekst",
                    url: "https://tihlde.org",
                    visibleFrom: VISIBLE_FROM,
                    visibleUntil: VISIBLE_UNTIL,
                },
            });
            expect(created.status).toBe(201);
            const banner = await created.json();

            const file = await storeAsset(ctx, { uploadedById: owner.id });
            const response = await client.api.banners[":id"].$patch({
                param: { id: banner.id },
                json: { url: file.url },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "own uploads, external links and what the banner already holds stay allowed",
        async ({ ctx }) => {
            const firstEditor = await ctx.utils.createTestUser();
            const nextEditor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(firstEditor, [
                "banners:manage",
            ]);
            await ctx.utils.giveUserPermissions(nextEditor, ["banners:manage"]);
            const firstClient = await ctx.utils.clientForUser(firstEditor);
            const nextClient = await ctx.utils.clientForUser(nextEditor);

            const own = await storeAsset(ctx, { uploadedById: firstEditor.id });
            const created = await firstClient.api.banners.$post({
                json: {
                    title: "Banner",
                    description: "Tekst",
                    url: own.url,
                    visibleFrom: VISIBLE_FROM,
                    visibleUntil: VISIBLE_UNTIL,
                },
            });
            expect(created.status).toBe(201);
            const banner = await created.json();

            const resaved = await nextClient.api.banners[":id"].$patch({
                param: { id: banner.id },
                json: { title: "Revidert", url: own.url },
            });
            expect(resaved.status).toBe(200);

            const external = await nextClient.api.banners[":id"].$patch({
                param: { id: banner.id },
                json: { url: "https://tihlde.org/arrangement" },
            });
            expect(external.status).toBe(200);
        },
        500_000,
    );
});

describe("Better Auth cannot write auth_user.image", () => {
    async function sessionCookie(
        ctx: IntegrationTestContext,
        user: Awaited<
            ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
        >,
    ): Promise<string> {
        const signIn = await ctx.auth.api.signInEmail({
            body: { email: user.email, password: user.password },
            returnHeaders: true,
        });
        return signIn.headers.getSetCookie()[0]?.split(";")[0] ?? "";
    }

    function updateUser(
        ctx: IntegrationTestContext,
        cookie: string,
        body: Record<string, unknown>,
    ) {
        return ctx.app.request("/api/auth/update-user", {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body: JSON.stringify(body),
        });
    }

    integrationTest(
        "/update-user refuses image, so a staged upload is not kept alive",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const member = await ctx.utils.createTestUser();
            const cookie = await sessionCookie(ctx, member);

            const file = await storeAsset(ctx, { uploadedById: owner.id });
            await ageAsset(ctx, file.key);

            const response = await updateUser(ctx, cookie, {
                image: file.url,
            });
            expect.soft(response.status).toBe(400);

            const row = await ctx.db.query.user.findFirst({
                where: { id: member.id },
                columns: { image: true },
            });
            expect.soft(row?.image).not.toBe(file.url);

            await runAssetCleanup(ctx);
            expect(await ctx.bucket.getAsset(file.key)).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "/update-user still takes the fields that are not an image",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const cookie = await sessionCookie(ctx, member);

            const response = await updateUser(ctx, cookie, {
                name: "Nytt Navn",
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "/sign-up/email refuses image, so a staged upload is not kept alive",
        async ({ ctx }) => {
            const owner = await ctx.utils.createTestUser();
            const file = await storeAsset(ctx, { uploadedById: owner.id });
            await ageAsset(ctx, file.key);

            const email = `ny-bruker-${counter++}@example.com`;
            const response = await ctx.app.request("/api/auth/sign-up/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Ny Bruker",
                    email,
                    password: "et-langt-passord-123",
                    image: file.url,
                }),
            });
            expect.soft(response.status).toBe(400);

            const row = await ctx.db.query.user.findFirst({
                where: { email },
                columns: { image: true },
            });
            expect.soft(row?.image ?? null).not.toBe(file.url);

            await runAssetCleanup(ctx);
            expect(await ctx.bucket.getAsset(file.key)).toBeNull();
        },
        500_000,
    );
});
