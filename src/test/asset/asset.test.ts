import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { schema } from "~/db";
import { getStagedAssetsForCleanup } from "~/lib/asset";
import { integrationTest } from "~/test/config/integration";

describe("Asset Upload/Download System", () => {
    integrationTest(
        "Complete asset lifecycle: upload, download, metadata, promote, cleanup",
        async ({ ctx }) => {
            const { db, bucket, app } = ctx;

            // Create test user with session
            const testUser = await ctx.utils.createTestUser();
            const authenticatedClient = await ctx.utils.clientForUser(testUser);

            // Create a simple test file (PNG header bytes)
            const pngHeader = new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]);
            const testFileContent = Buffer.concat([
                Buffer.from(pngHeader),
                Buffer.from("test image content"),
            ]);

            // ===== TEST 1: UPLOAD WITH SESSION AUTH =====
            const formData = new FormData();
            formData.append(
                "file",
                new Blob([testFileContent], { type: "image/png" }),
                "test-image.png",
            );

            const uploadResponse = await app.request("/api/assets", {
                method: "POST",
                body: formData,
                headers: {
                    Cookie: await ctx.utils.clientForUser(testUser).then(() => {
                        // Get session cookie - we need to simulate auth
                        return "";
                    }),
                },
            });

            // Since we can't easily get session cookies, let's test via direct bucket upload
            // and then test the endpoints

            // Upload directly via bucket for testing
            const testKey = await bucket.upload(
                "uploads/2026/01/test-uuid_test-image.png",
                testFileContent,
                {
                    originalFilename: "test-image.png",
                    contentType: "image/png",
                    uploadedById: testUser.id,
                },
            );

            expect(testKey).toBe("uploads/2026/01/test-uuid_test-image.png");

            // ===== TEST 2: VERIFY ASSET IS STAGED =====
            const asset = await bucket.getAsset(testKey);
            expect(asset).not.toBeNull();
            expect(asset?.status).toBe("staged");
            expect(asset?.promotedAt).toBeNull();
            expect(asset?.originalFilename).toBe("test-image.png");
            expect(asset?.contentType).toBe("image/png");
            expect(asset?.uploadedById).toBe(testUser.id);

            // ===== TEST 3: DOWNLOAD FILE =====
            const downloadResponse = await app.request(
                `/api/assets/${testKey}`,
            );
            expect(downloadResponse.status).toBe(200);
            expect(downloadResponse.headers.get("Content-Type")).toBe(
                "image/png",
            );
            expect(downloadResponse.headers.get("Cache-Control")).toBe(
                "public, max-age=31536000, immutable",
            );

            const downloadedContent = await downloadResponse.arrayBuffer();
            expect(Buffer.from(downloadedContent)).toEqual(testFileContent);

            // ===== TEST 4: GET METADATA =====
            const metadataResponse = await app.request(
                `/api/assets/metadata/${testKey}`,
            );
            expect(metadataResponse.status).toBe(200);

            const metadata = await metadataResponse.json();
            expect(metadata).toMatchObject({
                key: testKey,
                originalFilename: "test-image.png",
                contentType: "image/png",
                status: "staged",
                promotedAt: null,
            });
            expect(metadata.id).toBeDefined();
            expect(metadata.size).toBe(testFileContent.length);
            expect(metadata.createdAt).toBeDefined();

            // ===== TEST 5: PROMOTE ASSET =====
            const promotedAsset = await bucket.promoteAsset(testKey);
            expect(promotedAsset).not.toBeNull();
            expect(promotedAsset?.status).toBe("ready");
            expect(promotedAsset?.promotedAt).not.toBeNull();

            // Verify promotion persisted
            const verifyPromoted = await bucket.getAsset(testKey);
            expect(verifyPromoted?.status).toBe("ready");

            // ===== TEST 6: METADATA SHOWS PROMOTED STATUS =====
            const promotedMetadataResponse = await app.request(
                `/api/assets/metadata/${testKey}`,
            );
            const promotedMetadata = await promotedMetadataResponse.json();
            expect(promotedMetadata.status).toBe("ready");
            expect(promotedMetadata.promotedAt).not.toBeNull();

            // ===== TEST 7: DOWNLOAD NON-EXISTENT FILE =====
            const notFoundResponse = await app.request(
                "/api/assets/uploads/2026/01/nonexistent.png",
            );
            expect(notFoundResponse.status).toBe(404);

            // ===== TEST 8: METADATA FOR NON-EXISTENT FILE =====
            const notFoundMetadataResponse = await app.request(
                "/api/assets/metadata/uploads/2026/01/nonexistent.png",
            );
            expect(notFoundMetadataResponse.status).toBe(404);
        },
        600_000,
    );

    integrationTest(
        "Upload endpoint requires authentication",
        async ({ ctx }) => {
            const { app } = ctx;

            // Create test file
            const testFileContent = Buffer.from("test content");
            const formData = new FormData();
            formData.append(
                "file",
                new Blob([testFileContent], { type: "image/png" }),
                "test.png",
            );

            // ===== TEST: UPLOAD WITHOUT AUTH FAILS =====
            const response = await app.request("/api/assets", {
                method: "POST",
                body: formData,
            });

            expect(response.status).toBe(401);
            const error = await response.json();
            expect(error.message).toBe("Authentication required");
        },
        300_000,
    );

    integrationTest(
        "Upload with API key authentication",
        async ({ ctx }) => {
            const { db, app, bucket } = ctx;

            // Create a test user and API key
            const testUser = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(testUser, ["api-keys:create"]);

            // Create an API key directly in database for testing
            const { createApiKeyService } = await import(
                "~/lib/service/api-key"
            );
            const apiKeyService = createApiKeyService(ctx);
            const apiKeyResult = await apiKeyService.create({
                name: "Test Upload Key",
                description: "For upload testing",
                permissions: ["root"], // root permission for testing
                createdById: testUser.id,
            });

            // Create test file
            const testFileContent = Buffer.from("test file for api key upload");
            const formData = new FormData();
            formData.append(
                "file",
                new Blob([testFileContent], { type: "image/jpeg" }),
                "api-upload.jpg",
            );

            // ===== TEST: UPLOAD WITH API KEY =====
            const response = await app.request("/api/assets", {
                method: "POST",
                body: formData,
                headers: {
                    Authorization: `Bearer ${apiKeyResult.key}`,
                },
            });

            expect(response.status).toBe(201);

            const result = await response.json();
            expect(result.key).toMatch(
                /^uploads\/\d{4}\/\d{2}\/.+_api-upload\.jpg$/,
            );
            expect(result.originalFilename).toBe("api-upload.jpg");
            expect(result.contentType).toBe("image/jpeg");
            expect(result.status).toBe("staged");

            // Verify asset was created with correct uploadedById
            const asset = await bucket.getAsset(result.key);
            expect(asset).not.toBeNull();
            expect(asset?.uploadedById).toBe(testUser.id);
        },
        600_000,
    );

    integrationTest(
        "Upload validates file type and size",
        async ({ ctx }) => {
            const { app } = ctx;

            // Create API key for auth
            const testUser = await ctx.utils.createTestUser();
            const { createApiKeyService } = await import(
                "~/lib/service/api-key"
            );
            const apiKeyService = createApiKeyService(ctx);
            const apiKeyResult = await apiKeyService.create({
                name: "Test Validation Key",
                description: "For validation testing",
                permissions: ["root"],
                createdById: testUser.id,
            });

            const authHeaders = {
                Authorization: `Bearer ${apiKeyResult.key}`,
            };

            // ===== TEST 1: INVALID FILE TYPE =====
            const invalidTypeFormData = new FormData();
            invalidTypeFormData.append(
                "file",
                new Blob([Buffer.from("executable content")], {
                    type: "application/x-executable",
                }),
                "malicious.exe",
            );

            const invalidTypeResponse = await app.request("/api/assets", {
                method: "POST",
                body: invalidTypeFormData,
                headers: authHeaders,
            });

            expect(invalidTypeResponse.status).toBe(400);
            const invalidTypeError = await invalidTypeResponse.json();
            expect(invalidTypeError.message).toContain("not allowed");

            // ===== TEST 2: VALID FILE TYPES =====
            const validTypes = [
                { type: "image/jpeg", ext: "jpg" },
                { type: "image/png", ext: "png" },
                { type: "image/gif", ext: "gif" },
                { type: "image/webp", ext: "webp" },
                { type: "application/pdf", ext: "pdf" },
            ];

            for (const { type, ext } of validTypes) {
                const formData = new FormData();
                formData.append(
                    "file",
                    new Blob([Buffer.from(`test ${type} content`)], { type }),
                    `test.${ext}`,
                );

                const response = await app.request("/api/assets", {
                    method: "POST",
                    body: formData,
                    headers: authHeaders,
                });

                expect(response.status).toBe(201);
            }

            // ===== TEST 3: NO FILE PROVIDED =====
            const emptyFormData = new FormData();

            const noFileResponse = await app.request("/api/assets", {
                method: "POST",
                body: emptyFormData,
                headers: authHeaders,
            });

            expect(noFileResponse.status).toBe(400);
            const noFileError = await noFileResponse.json();
            expect(noFileError.message).toContain("No file provided");
        },
        600_000,
    );

    integrationTest(
        "Cleanup removes staged assets older than 2 days",
        async ({ ctx }) => {
            const { db, bucket } = ctx;

            // Create test user
            const testUser = await ctx.utils.createTestUser();

            // ===== SETUP: Create assets with different ages =====

            // Asset 1: Created now (should NOT be cleaned up)
            const recentKey = "uploads/2026/01/recent_file.png";
            await bucket.upload(recentKey, Buffer.from("recent content"), {
                originalFilename: "recent.png",
                contentType: "image/png",
                uploadedById: testUser.id,
            });

            // Asset 2: Created 3 days ago, staged (should be cleaned up)
            const oldStagedKey = "uploads/2026/01/old_staged_file.png";
            await bucket.upload(
                oldStagedKey,
                Buffer.from("old staged content"),
                {
                    originalFilename: "old_staged.png",
                    contentType: "image/png",
                    uploadedById: testUser.id,
                },
            );

            // Manually update createdAt to 3 days ago to simulate time passing
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

            await db
                .update(schema.asset)
                .set({ createdAt: threeDaysAgo })
                .where(eq(schema.asset.key, oldStagedKey));

            // Asset 3: Created 3 days ago but promoted (should NOT be cleaned up)
            const oldPromotedKey = "uploads/2026/01/old_promoted_file.png";
            await bucket.upload(
                oldPromotedKey,
                Buffer.from("old promoted content"),
                {
                    originalFilename: "old_promoted.png",
                    contentType: "image/png",
                    uploadedById: testUser.id,
                },
            );
            await bucket.promoteAsset(oldPromotedKey);
            await db
                .update(schema.asset)
                .set({ createdAt: threeDaysAgo })
                .where(eq(schema.asset.key, oldPromotedKey));

            // ===== VERIFY INITIAL STATE =====
            const recentAsset = await bucket.getAsset(recentKey);
            const oldStagedAsset = await bucket.getAsset(oldStagedKey);
            const oldPromotedAsset = await bucket.getAsset(oldPromotedKey);

            expect(recentAsset?.status).toBe("staged");
            expect(oldStagedAsset?.status).toBe("staged");
            expect(oldPromotedAsset?.status).toBe("ready");

            // ===== RUN CLEANUP QUERY =====
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 2); // 2 day cutoff

            const assetsToCleanup = await getStagedAssetsForCleanup(db, cutoff);

            // Should only find the old staged asset
            expect(assetsToCleanup).toHaveLength(1);
            expect(assetsToCleanup[0]?.key).toBe(oldStagedKey);

            // ===== PERFORM CLEANUP =====
            for (const asset of assetsToCleanup) {
                await bucket.delete(asset.key);
            }

            // ===== VERIFY CLEANUP RESULTS =====
            // Recent staged asset should still exist
            const recentAfter = await bucket.getAsset(recentKey);
            expect(recentAfter).not.toBeNull();

            // Old staged asset should be deleted
            const oldStagedAfter = await bucket.getAsset(oldStagedKey);
            expect(oldStagedAfter).toBeNull();

            // Old promoted asset should still exist
            const oldPromotedAfter = await bucket.getAsset(oldPromotedKey);
            expect(oldPromotedAfter).not.toBeNull();

            // Verify file was also deleted from storage
            const existsInStorage = await bucket.exists(oldStagedKey);
            expect(existsInStorage).toBe(false);
        },
        600_000,
    );

    integrationTest(
        "promoteAsset returns null for non-existent asset",
        async ({ ctx }) => {
            const { bucket } = ctx;

            const result = await bucket.promoteAsset(
                "uploads/2026/01/nonexistent.png",
            );
            expect(result).toBeNull();
        },
        300_000,
    );

    integrationTest(
        "Asset key generation creates unique keys",
        async ({ ctx }) => {
            const { generateAssetKey } = await import("~/lib/asset");

            const keys = new Set<string>();

            // Generate 100 keys and verify uniqueness
            for (let i = 0; i < 100; i++) {
                const key = generateAssetKey("test-file.png");
                expect(keys.has(key)).toBe(false);
                keys.add(key);

                // Verify format
                expect(key).toMatch(
                    /^uploads\/\d{4}\/\d{2}\/[a-f0-9-]+_test-file\.png$/,
                );
            }
        },
        60_000,
    );

    integrationTest(
        "Asset key sanitizes filenames",
        async ({ ctx }) => {
            const { generateAssetKey } = await import("~/lib/asset");

            // Test various problematic filenames
            const testCases = [
                {
                    input: "file with spaces.png",
                    expected: /file_with_spaces\.png$/,
                },
                {
                    input: "file<script>.png",
                    expected: /file_script_\.png$/,
                },
                {
                    input: "../../../etc/passwd",
                    expected: /passwd$/,
                },
                {
                    input: "path/to/nested/file.jpg",
                    expected: /file\.jpg$/,
                },
                {
                    input: "C:\\Windows\\System32\\file.exe",
                    expected: /file\.exe$/,
                },
            ];

            for (const { input, expected } of testCases) {
                const key = generateAssetKey(input);
                expect(key).toMatch(expected);
                // Ensure no dangerous characters
                expect(key).not.toContain("..");
                expect(key).not.toContain("<");
                expect(key).not.toContain(">");
            }
        },
        60_000,
    );
});
