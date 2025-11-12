import { expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

integrationTest(
    "Full CRUD workflow with all endpoints",
    async ({ ctx }) => {
        const { db } = ctx;

        // Create a test user with api-keys permissions
        const [testUser] = await db
            .insert(schema.user)
            .values({
                id: "test-user-id",
                name: "Test User",
                email: "test@example.com",
                emailVerified: true,
            })
            .returning();

        if (!testUser) {
            throw new Error("Failed to create test user");
        }

        // Assign permissions directly to user
        await db.insert(schema.userPermission).values([
            {
                userId: testUser.id,
                permission: "api-keys:view",
                scope: null,
            },
            {
                userId: testUser.id,
                permission: "api-keys:create",
                scope: null,
            },
            {
                userId: testUser.id,
                permission: "api-keys:update",
                scope: null,
            },
            {
                userId: testUser.id,
                permission: "api-keys:delete",
                scope: null,
            },
        ]);

        // Create a session for the user
        const [session] = await db
            .insert(schema.session)
            .values({
                id: "test-session-id",
                token: "test-token",
                userId: testUser.id,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
            })
            .returning();

        if (!session) {
            throw new Error("Failed to create test session");
        }

        const client = ctx.utils.client({
            Cookie: `better-auth.session_token=${session.token}`,
        });

        // ===== TEST 1: CREATE API KEY =====
        const createResponse = await client.api["api-keys"].$post({
            json: {
                name: "Test Integration Key",
                description: "Used for integration testing",
                permissions: ["email:send", "news:view"],
                metadata: {
                    environment: "test",
                    service: "integration-test",
                },
            },
        });

        expect(createResponse.status).toBe(201);

        const createdKey = await createResponse.json();
        expect(createdKey).toMatchObject({
            name: "Test Integration Key",
            description: "Used for integration testing",
            permissions: ["email:send", "news:view"],
            metadata: {
                environment: "test",
                service: "integration-test",
            },
            createdById: testUser.id,
        });

        // Verify full key is returned once
        expect(createdKey.key).toBeDefined();
        expect(createdKey.key).toMatch(/^photon_/);
        expect(createdKey.keyPrefix).toBe(createdKey.key.substring(0, 12));

        const apiKeyId = createdKey.id;
        const fullKey = createdKey.key;

        // ===== TEST 2: VALIDATE API KEY (public endpoint) =====
        const validateResponse = await client.api["api-keys"].validate.$post({
            json: {
                key: fullKey,
            },
        });

        expect(validateResponse.status).toBe(200);

        const validationResult = await validateResponse.json();
        expect(validationResult.valid).toBe(true);
        expect(validationResult.apiKey).toBeDefined();
        expect(validationResult.apiKey).toMatchObject({
            id: apiKeyId,
            name: "Test Integration Key",
            permissions: ["email:send", "news:view"],
        });

        // Verify lastUsedAt was updated
        expect(validationResult.apiKey?.lastUsedAt).not.toBeNull();

        // ===== TEST 3: VALIDATE INVALID KEY =====
        const invalidValidateResponse = await client.api[
            "api-keys"
        ].validate.$post({
            json: {
                key: "photon_invalidkeyhere",
            },
        });

        expect(invalidValidateResponse.status).toBe(200);

        const invalidResult = await invalidValidateResponse.json();
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.apiKey).toBeUndefined();

        // ===== TEST 4: LIST API KEYS =====
        const listResponse = await client.api["api-keys"].$get();

        expect(listResponse.status).toBe(200);

        const apiKeys = await listResponse.json();
        expect(Array.isArray(apiKeys)).toBe(true);
        expect(apiKeys).toHaveLength(1);
        expect(apiKeys[0]).toMatchObject({
            id: apiKeyId,
            name: "Test Integration Key",
        });

        // Verify full key is NOT included in list
        expect(apiKeys[0]).not.toHaveProperty("key");

        // ===== TEST 5: GET SINGLE API KEY =====
        const getResponse = await client.api["api-keys"][":id"].$get({
            param: { id: apiKeyId },
        });

        expect(getResponse.status).toBe(200);

        const apiKey = await getResponse.json();
        expect(apiKey).toMatchObject({
            id: apiKeyId,
            name: "Test Integration Key",
            permissions: ["email:send", "news:view"],
        });

        // Verify full key is NOT included
        expect(apiKey).not.toHaveProperty("key");

        // ===== TEST 6: GET NON-EXISTENT API KEY =====
        const nonExistentResponse = await client.api["api-keys"][":id"].$get({
            param: { id: "00000000-0000-0000-0000-000000000000" },
        });

        expect(nonExistentResponse.status).toBe(404);

        // ===== TEST 7: UPDATE API KEY =====
        const updateResponse = await client.api["api-keys"][":id"].$patch({
            param: { id: apiKeyId },
            json: {
                name: "Updated Integration Key",
                description: "Updated description",
                permissions: ["email:send"],
                metadata: {
                    environment: "production",
                },
            },
        });

        expect(updateResponse.status).toBe(200);

        const updatedKey = await updateResponse.json();
        expect(updatedKey).toMatchObject({
            id: apiKeyId,
            name: "Updated Integration Key",
            description: "Updated description",
            permissions: ["email:send"],
            metadata: {
                environment: "production",
            },
        });

        // ===== TEST 8: REGENERATE API KEY =====
        const regenerateResponse = await client.api["api-keys"][
            ":id"
        ].regenerate.$post({
            param: { id: apiKeyId },
        });

        expect(regenerateResponse.status).toBe(200);

        const regeneratedKey = await regenerateResponse.json();

        // Verify new key is returned
        expect(regeneratedKey.key).toBeDefined();
        expect(regeneratedKey.key).toMatch(/^photon_/);
        expect(regeneratedKey.key).not.toBe(fullKey); // Different from original

        // Verify metadata preserved
        expect(regeneratedKey).toMatchObject({
            id: apiKeyId,
            name: "Updated Integration Key",
            description: "Updated description",
        });

        // ===== TEST 9: OLD KEY NO LONGER VALID =====
        const oldKeyValidation = await client.api["api-keys"].validate.$post({
            json: {
                key: fullKey,
            },
        });

        const oldKeyResult = await oldKeyValidation.json();
        expect(oldKeyResult.valid).toBe(false);

        // ===== TEST 10: NEW KEY IS VALID =====
        const newKeyValidation = await client.api["api-keys"].validate.$post({
            json: {
                key: regeneratedKey.key,
            },
        });

        const newKeyResult = await newKeyValidation.json();
        expect(newKeyResult.valid).toBe(true);
        expect(newKeyResult.apiKey?.id).toBe(apiKeyId);

        // ===== TEST 11: DELETE API KEY =====
        const deleteResponse = await client.api["api-keys"][":id"].$delete({
            param: { id: apiKeyId },
        });

        expect(deleteResponse.status).toBe(200);

        const deleteResult = await deleteResponse.json();
        expect(deleteResult.message).toBe("API key deleted successfully");

        // ===== TEST 12: DELETED KEY NO LONGER VALID =====
        const deletedKeyValidation = await client.api[
            "api-keys"
        ].validate.$post({
            json: {
                key: regeneratedKey.key,
            },
        });

        const deletedKeyResult = await deletedKeyValidation.json();
        expect(deletedKeyResult.valid).toBe(false);

        // ===== TEST 13: DELETED KEY NOT IN LIST =====
        const finalListResponse = await client.api["api-keys"].$get();
        const finalList = await finalListResponse.json();
        expect(finalList).toHaveLength(0);

        // ===== TEST 14: DELETED KEY CANNOT BE RETRIEVED =====
        const deletedGetResponse = await client.api["api-keys"][":id"].$get({
            param: { id: apiKeyId },
        });

        expect(deletedGetResponse.status).toBe(404);

        // ===== TEST 15: UNAUTHORIZED ACCESS (no permissions) =====
        const [unauthorizedUser] = await db
            .insert(schema.user)
            .values({
                id: "unauthorized-user",
                name: "Unauthorized User",
                email: "unauthorized@example.com",
                emailVerified: true,
            })
            .returning();

        if (!unauthorizedUser) {
            throw new Error("Failed to create unauthorized user");
        }

        const [unauthorizedSession] = await db
            .insert(schema.session)
            .values({
                id: "unauthorized-session",
                token: "unauthorized-token",
                userId: unauthorizedUser.id,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            })
            .returning();

        if (!unauthorizedSession) {
            throw new Error("Failed to create unauthorized session");
        }

        const unauthorizedClient = ctx.utils.client({
            Cookie: `better-auth.session_token=${unauthorizedSession.token}`,
        });

        const unauthorizedCreateResponse = await unauthorizedClient.api[
            "api-keys"
        ].$post({
            json: {
                name: "Unauthorized Key",
                description: "Should fail",
                permissions: ["email:send"],
            },
        });

        expect(unauthorizedCreateResponse.status).toBe(403);

        // ===== TEST 16: UNAUTHENTICATED ACCESS =====
        const unauthenticatedClient = ctx.utils.client();

        const unauthenticatedResponse =
            await unauthenticatedClient.api["api-keys"].$get();

        expect(unauthenticatedResponse.status).toBe(401);

        // ===== TEST 17: INVALID PERMISSIONS =====
        const invalidPermissionsResponse = await client.api["api-keys"].$post({
            json: {
                name: "Invalid Permissions Key",
                description: "Should fail",
                permissions: ["invalid:permission"],
            },
        });

        // The service should throw an error for invalid permissions
        expect(invalidPermissionsResponse.status).toBe(500);
    },
    600_000, // 10 minute timeout for comprehensive test
);
