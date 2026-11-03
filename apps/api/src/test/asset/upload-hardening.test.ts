import sharp from "sharp";
import { describe, expect, vi } from "vitest";
import { isImageQueueFull, withImageSlot } from "~/lib/asset/image";
import { runAssetCleanup } from "~/lib/asset/worker";
import { createApiKeyService } from "~/lib/service/api-key";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const GIF = Buffer.concat([
    Buffer.from("GIF89a"),
    Buffer.from([1, 0, 1, 0, 0, 0, 0]),
]);

function photo(width: number, height: number) {
    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: { r: 190, g: 40, b: 60 },
        },
    });
}

function uploadForm(bytes: Buffer, type: string, name: string) {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), name);
    return form;
}

async function sessionHeaders(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    const signedIn = await ctx.auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        returnHeaders: true,
    });
    const cookie = signedIn.headers.getSetCookie()[0]?.split(";")[0];
    if (!cookie) throw new Error("No session cookie returned");
    return { Cookie: cookie };
}

async function apiKeyHeaders(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    const created = await createApiKeyService(ctx).create({
        name: "Søsterapp",
        description: "Laster opp fra en annen tjeneste",
        permissions: ["root"],
        createdById: user.id,
    });
    return { Authorization: `Bearer ${created.key}` };
}

function postUpload(
    ctx: IntegrationTestContext,
    headers: Record<string, string>,
    form: FormData,
) {
    return ctx.app.request("/api/assets", {
        method: "POST",
        body: form,
        headers,
    });
}

async function storeImage(
    ctx: IntegrationTestContext,
    name: string,
    status: "staged" | "ready",
) {
    const key = `uploads/2026/01/${name}.png`;
    await ctx.bucket.upload(key, await photo(800, 600).png().toBuffer(), {
        originalFilename: `${name}.png`,
        contentType: "image/png",
    });
    if (status === "ready") await ctx.bucket.promoteAsset(key);
    return key;
}

describe("the real file type decides what is stored", () => {
    integrationTest(
        "a file that is not what it claims to be is refused",
        async ({ ctx }) => {
            const headers = await apiKeyHeaders(ctx);

            const disguised: [string, Buffer, string][] = [
                [
                    "HTML as PNG",
                    Buffer.from("<!doctype html><script>1</script>"),
                    "image/png",
                ],
                [
                    "SVG as PNG",
                    Buffer.from(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"/>',
                    ),
                    "image/png",
                ],
                [
                    "text as PDF",
                    Buffer.from("just some words"),
                    "application/pdf",
                ],
                ["empty file as JPEG", Buffer.alloc(0), "image/jpeg"],
            ];

            for (const [label, bytes, type] of disguised) {
                const response = await postUpload(
                    ctx,
                    headers,
                    uploadForm(bytes, type, "fil.png"),
                );
                expect(response.status, label).toBe(400);
            }
        },
        60_000,
    );

    integrationTest(
        "formats members upload keep working, whatever the browser called them",
        async ({ ctx }) => {
            const headers = await apiKeyHeaders(ctx);

            const jpeg = await photo(3000, 2000).jpeg().toBuffer();
            const png = await photo(3000, 2000).png().toBuffer();
            const webp = await photo(20, 20).webp().toBuffer();
            const pdf = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");

            // kvarks HEIC-konvertering sender en ekte JPEG.
            const heicConverted = await postUpload(
                ctx,
                headers,
                uploadForm(jpeg, "image/jpeg", "IMG_0001.jpg"),
            );
            expect(heicConverted.status).toBe(201);
            expect((await heicConverted.json()) as object).toMatchObject({
                contentType: "image/webp",
                originalFilename: "IMG_0001.webp",
            });

            // A browser derives the type from the extension, so a PNG someone
            // renamed to .jpg arrives claiming to be a JPEG. It is still a
            // perfectly good picture.
            const renamed = await postUpload(
                ctx,
                headers,
                uploadForm(png, "image/jpeg", "skjermbilde.jpg"),
            );
            expect(renamed.status).toBe(201);

            const compressedInBrowser = await postUpload(
                ctx,
                headers,
                uploadForm(webp, "image/webp", "blob.webp"),
            );
            expect(compressedInBrowser.status).toBe(201);
            expect((await compressedInBrowser.json()) as object).toMatchObject({
                contentType: "image/webp",
                originalFilename: "blob.webp",
            });

            const gif = await postUpload(
                ctx,
                headers,
                uploadForm(GIF, "image/gif", "animasjon.gif"),
            );
            expect(gif.status).toBe(201);
            expect((await gif.json()) as object).toMatchObject({
                contentType: "image/gif",
                size: GIF.length,
            });

            const document = await postUpload(
                ctx,
                headers,
                uploadForm(pdf, "application/pdf", "dokument.pdf"),
            );
            expect(document.status).toBe(201);
            expect((await document.json()) as object).toMatchObject({
                contentType: "application/pdf",
                size: pdf.length,
            });

            // Readers accept a PDF header that does not open the file, and
            // old scanners and mail gateways do write one like that.
            const prefixed = Buffer.concat([Buffer.from("\r\n\r\n"), pdf]);
            const prefixedDocument = await postUpload(
                ctx,
                headers,
                uploadForm(prefixed, "application/pdf", "skann.pdf"),
            );
            expect(prefixedDocument.status).toBe(201);
        },
        60_000,
    );

    integrationTest(
        "the stored type is the real one, not the one that was declared",
        async ({ ctx }) => {
            const headers = await apiKeyHeaders(ctx);

            const response = await postUpload(
                ctx,
                headers,
                uploadForm(GIF, "image/png", "feilmerket.png"),
            );

            expect(response.status).toBe(201);
            expect((await response.json()) as object).toMatchObject({
                contentType: "image/gif",
            });
        },
        60_000,
    );
});

describe("image decoding is bounded", () => {
    integrationTest(
        "an image with more pixels than we are willing to decode is refused",
        async ({ ctx }) => {
            const headers = await apiKeyHeaders(ctx);
            const oversized = await photo(12_000, 10_500).png().toBuffer();

            const response = await postUpload(
                ctx,
                headers,
                uploadForm(oversized, "image/png", "enormt.png"),
            );

            expect(response.status).toBe(400);
        },
        120_000,
    );

    integrationTest(
        "only the formats we re-encode reach a decoder when a variant is requested",
        async ({ ctx }) => {
            const svg = Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"/>',
            );
            const key = "uploads/2026/01/gammel_feilmerket.png";
            await ctx.bucket.upload(key, svg, {
                originalFilename: "gammel_feilmerket.png",
                contentType: "image/png",
            });
            await ctx.bucket.promoteAsset(key);

            const response = await ctx.app.request(`/api/assets/${key}?w=320`);

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("image/png");
            expect(Buffer.from(await response.arrayBuffer())).toEqual(svg);
        },
        60_000,
    );
});

describe("per-user upload limits", () => {
    integrationTest(
        "a signed-in user is stopped by the burst limit, and other users are not",
        async ({ ctx }) => {
            const flooder = await sessionHeaders(ctx);
            const statuses: number[] = [];

            for (let i = 0; i < 125; i++) {
                const response = await postUpload(
                    ctx,
                    flooder,
                    uploadForm(GIF, "image/gif", `${i}.gif`),
                );
                statuses.push(response.status);
            }

            expect(statuses.slice(0, 120).every((s) => s === 201)).toBe(true);
            expect(statuses.slice(120).every((s) => s === 429)).toBe(true);

            const someoneElse = await postUpload(
                ctx,
                await sessionHeaders(ctx),
                uploadForm(GIF, "image/gif", "annen.gif"),
            );
            expect(someoneElse.status).toBe(201);

            vi.useFakeTimers({
                toFake: ["Date"],
                now: Date.now() + 61_000,
            });
            try {
                const nextMinute = await postUpload(
                    ctx,
                    flooder,
                    uploadForm(GIF, "image/gif", "neste.gif"),
                );
                expect(nextMinute.status).toBe(201);
            } finally {
                vi.useRealTimers();
            }
        },
        300_000,
    );

    integrationTest(
        "the daily limit holds even when uploads are paced under the burst limit",
        async ({ ctx }) => {
            const headers = await sessionHeaders(ctx);
            const realGet = ctx.cache.getString.bind(ctx.cache);
            const get = vi
                .spyOn(ctx.cache, "getString")
                .mockImplementation(async (key) =>
                    key.startsWith("asset-upload:day:") ? "2000" : realGet(key),
                );

            const response = await postUpload(
                ctx,
                headers,
                uploadForm(GIF, "image/gif", "for-mange.gif"),
            );
            get.mockRestore();

            expect(response.status).toBe(429);
        },
        60_000,
    );

    integrationTest(
        "an unreachable cache does not stop uploads",
        async ({ ctx }) => {
            const headers = await sessionHeaders(ctx);
            const get = vi
                .spyOn(ctx.cache, "getString")
                .mockRejectedValue(new Error("Redis er nede"));

            const response = await postUpload(
                ctx,
                headers,
                uploadForm(GIF, "image/gif", "uten-redis.gif"),
            );
            get.mockRestore();

            expect(response.status).toBe(201);
        },
        60_000,
    );

    integrationTest(
        "parallel uploads from one user are capped while they are in flight",
        async ({ ctx }) => {
            const headers = await sessionHeaders(ctx);

            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const realUpload = ctx.bucket.upload.bind(ctx.bucket);
            const upload = vi
                .spyOn(ctx.bucket, "upload")
                .mockImplementation(async (...args) => {
                    await gate;
                    return realUpload(...args);
                });

            const pending = Array.from({ length: 20 }, (_, i) =>
                postUpload(
                    ctx,
                    headers,
                    uploadForm(GIF, "image/gif", `${i}.gif`),
                ),
            );

            await vi.waitFor(() => expect(upload).toHaveBeenCalled());
            await new Promise((resolve) => setTimeout(resolve, 200));
            release();

            const statuses = (await Promise.all(pending)).map((r) => r.status);
            upload.mockRestore();

            expect(statuses.filter((s) => s === 201)).toHaveLength(6);
            expect(statuses.filter((s) => s === 429)).toHaveLength(14);

            const afterwards = await postUpload(
                ctx,
                headers,
                uploadForm(GIF, "image/gif", "etterpå.gif"),
            );
            expect(afterwards.status).toBe(201);
        },
        60_000,
    );

    integrationTest(
        "server-to-server uploads with an API key are not limited",
        async ({ ctx }) => {
            const headers = await apiKeyHeaders(ctx);

            for (let i = 0; i < 125; i++) {
                const response = await postUpload(
                    ctx,
                    headers,
                    uploadForm(GIF, "image/gif", `${i}.gif`),
                );
                expect(response.status).toBe(201);
            }
        },
        300_000,
    );

    integrationTest(
        "staged uploads are cleaned up faster than the old hundred an hour",
        async ({ ctx }) => {
            for (let i = 0; i < 101; i++) {
                await ctx.bucket.upload(
                    `uploads/2020/01/gammel-${i}.gif`,
                    GIF,
                    {
                        originalFilename: `gammel-${i}.gif`,
                        contentType: "image/gif",
                    },
                );
            }

            vi.useFakeTimers({
                toFake: ["Date"],
                now: Date.now() + 3 * 24 * 60 * 60 * 1000,
            });
            try {
                const result = await runAssetCleanup(ctx);
                expect(result.deleted).toBe(101);
            } finally {
                vi.useRealTimers();
            }
        },
        120_000,
    );
});

describe("variant generation is bounded", () => {
    integrationTest(
        "at most four images are decoded at the same time",
        async () => {
            let running = 0;
            let peak = 0;

            await Promise.all(
                Array.from({ length: 20 }, () =>
                    withImageSlot(async () => {
                        running++;
                        peak = Math.max(peak, running);
                        await new Promise((resolve) => setTimeout(resolve, 5));
                        running--;
                    }),
                ),
            );

            expect(peak).toBe(4);
        },
        60_000,
    );

    integrationTest(
        "a full queue serves the original instead of waiting in line",
        async ({ ctx }) => {
            const key = await storeImage(ctx, "full-koe", "ready");

            let release = () => {};
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const held = Array.from({ length: 54 }, () =>
                withImageSlot(() => gate),
            );
            expect(isImageQueueFull()).toBe(true);

            const response = await ctx.app.request(`/api/assets/${key}?w=320`);
            release();
            await Promise.all(held);

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("image/png");
            expect(response.headers.get("Cache-Control")).toBe("no-store");
            expect(
                await ctx.bucket.getObject(`derivatives/w320/${key}.webp`),
            ).toBeNull();
        },
        60_000,
    );

    integrationTest(
        "a sweep over many assets hits the hourly budget and gets originals",
        async ({ ctx }) => {
            const key = await storeImage(ctx, "soek", "ready");
            const realGet = ctx.cache.getString.bind(ctx.cache);
            const get = vi
                .spyOn(ctx.cache, "getString")
                .mockImplementation(async (cacheKey) =>
                    cacheKey.startsWith("asset-variant:all:")
                        ? "1000"
                        : realGet(cacheKey),
                );

            const response = await ctx.app.request(`/api/assets/${key}?w=320`);
            get.mockRestore();

            expect(response.headers.get("Content-Type")).toBe("image/png");
            expect(response.headers.get("Cache-Control")).toBe("no-store");
        },
        60_000,
    );

    integrationTest(
        "simultaneous requests for one variant encode and store it once",
        async ({ ctx }) => {
            const key = await storeImage(ctx, "samtidig", "ready");
            const put = vi.spyOn(ctx.bucket, "putObject");

            const responses = await Promise.all(
                Array.from({ length: 10 }, () =>
                    ctx.app.request(`/api/assets/${key}?w=320`),
                ),
            );

            for (const response of responses) {
                expect(response.status).toBe(200);
                expect(response.headers.get("Content-Type")).toBe("image/webp");
            }
            expect(put).toHaveBeenCalledTimes(1);
            put.mockRestore();
        },
        60_000,
    );

    integrationTest(
        "one asset cannot be re-encoded over and over when the cache write fails",
        async ({ ctx }) => {
            const key = await storeImage(ctx, "full-boette", "ready");
            const download = vi.spyOn(ctx.bucket, "download");
            const put = vi
                .spyOn(ctx.bucket, "putObject")
                .mockRejectedValue(new Error("QuotaExceeded"));

            const responses: Response[] = [];
            for (let i = 0; i < 20; i++) {
                responses.push(
                    await ctx.app.request(`/api/assets/${key}?w=320`),
                );
            }

            expect(put.mock.calls.length).toBeLessThanOrEqual(14);

            // The picture still shows, but a fallback must not be cached as if
            // it were the variant, or the URL keeps the heavy file for a year.
            const last = responses.at(-1);
            expect(last?.status).toBe(200);
            expect(last?.headers.get("Content-Type")).toBe("image/png");
            expect(last?.headers.get("Cache-Control")).toBe("no-store");

            put.mockRestore();
            download.mockRestore();
        },
        60_000,
    );

    integrationTest(
        "a staged asset never adds variant objects to the bucket",
        async ({ ctx }) => {
            const key = await storeImage(ctx, "ikke-tatt-i-bruk", "staged");
            const variantKey = `derivatives/w320/${key}.webp`;

            const staged = await ctx.app.request(`/api/assets/${key}?w=320`);

            expect(staged.status).toBe(200);
            expect(staged.headers.get("Content-Type")).toBe("image/webp");
            expect(await ctx.bucket.getObject(variantKey)).toBeNull();

            await ctx.bucket.promoteAsset(key);
            const promoted = await ctx.app.request(`/api/assets/${key}?w=320`);

            expect(promoted.status).toBe(200);
            expect(await ctx.bucket.getObject(variantKey)).not.toBeNull();
        },
        60_000,
    );
});
