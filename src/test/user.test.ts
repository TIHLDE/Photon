import { describe, expect } from "vitest";
import { schema } from "~/db";
import { integrationTest } from "~/test/config/integration";

describe("user endpoints", () => {
    // ===== GET /api/user/allergy (List Allergies) =====

    integrationTest(
        "successfully retrieves all allergies",
        async ({ ctx }) => {
            const { db } = ctx;

            // Create test allergies
            await db.insert(schema.allergy).values([
                {
                    slug: "lactose",
                    label: "Lactose Intolerance",
                    description: "Cannot digest lactose",
                },
                {
                    slug: "gluten",
                    label: "Gluten Intolerance",
                    description: "Cannot digest gluten",
                },
                {
                    slug: "nuts",
                    label: "Nut Allergy",
                    description: "Allergic to nuts",
                },
            ]);

            const client = ctx.utils.client();

            const response = await client.api.user.allergy.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(Array.isArray(json)).toBe(true);
            expect(json.length).toBe(3);
            expect(json[0]).toHaveProperty("slug");
            expect(json[0]).toHaveProperty("label");
            expect(json[0]).toHaveProperty("description");
        },
        500_000,
    );

    integrationTest(
        "returns empty array when no allergies exist",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.user.allergy.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(Array.isArray(json)).toBe(true);
            expect(json.length).toBe(0);
        },
        500_000,
    );

    // ===== GET /api/user/me/settings (Get Settings) =====

    integrationTest(
        "successfully retrieves settings for onboarded user",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create test allergies
            await db.insert(schema.allergy).values([
                {
                    slug: "lactose",
                    label: "Lactose Intolerance",
                    description: "Cannot digest lactose",
                },
            ]);

            // Create user settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: true,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
                bioDescription: "Test bio",
                githubUrl: "https://github.com/testuser",
                linkedinUrl: "https://linkedin.com/in/testuser",
                imageUrl: "https://example.com/image.jpg",
            });

            // Add allergy
            await db.insert(schema.userAllergy).values({
                userId: user.id,
                allergySlug: "lactose",
            });

            const response = await client.api.user.me.settings.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.gender).toBe("male");
            expect(json.allowsPhotosByDefault).toBe(true);
            expect(json.acceptsEventRules).toBe(true);
            expect(json.receiveMailCommunication).toBe(true);
            expect(json.isOnboarded).toBe(true);
            expect(json.bioDescription).toBe("Test bio");
            expect(json.githubUrl).toBe("https://github.com/testuser");
            expect(json.linkedinUrl).toBe("https://linkedin.com/in/testuser");
            expect(json.imageUrl).toBe("https://example.com/image.jpg");
            expect(json.allergies).toEqual(["lactose"]);
        },
        500_000,
    );

    integrationTest(
        "returns 404 for user without settings",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$get();

            expect(response.status).toBe(404);

            const json = (await response.json()) as unknown as { message: string };
            expect(json.message).toBe(
                "User settings not found. Please complete onboarding.",
            );
        },
        500_000,
    );

    integrationTest(
        "returns 401 for unauthenticated user when getting settings",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.user.me.settings.$get();

            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "includes isOnboarded flag in settings response",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create user settings with isOnboarded = false
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "female",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: false,
                isOnboarded: false,
            });

            const response = await client.api.user.me.settings.$get();

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.isOnboarded).toBe(false);
        },
        500_000,
    );

    // ===== POST /api/user/me/settings (Onboarding) =====

    integrationTest(
        "successfully creates settings with valid data",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create test allergies
            await db.insert(schema.allergy).values([
                {
                    slug: "gluten",
                    label: "Gluten Intolerance",
                    description: "Cannot digest gluten",
                },
            ]);

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "male",
                    allowsPhotosByDefault: true,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: ["gluten"],
                    bioDescription: "New user bio",
                    githubUrl: "https://github.com/newuser",
                    linkedinUrl: "https://linkedin.com/in/newuser",
                    imageUrl: "https://example.com/avatar.jpg",
                },
            });

            expect(response.status).toBe(201);

            const json = await response.json();
            expect(json.gender).toBe("male");
            expect(json.allowsPhotosByDefault).toBe(true);
            expect(json.acceptsEventRules).toBe(true);
            expect(json.receiveMailCommunication).toBe(true);
            expect(json.allergies).toEqual(["gluten"]);
            expect(json.bioDescription).toBe("New user bio");
            expect(json.githubUrl).toBe("https://github.com/newuser");
            expect(json.linkedinUrl).toBe("https://linkedin.com/in/newuser");
            expect(json.imageUrl).toBe("https://example.com/avatar.jpg");

            // Verify isOnboarded is set to true in database
            const settings = await db.query.userSettings.findFirst({
                where: (s, { eq }) => eq(s.userId, user.id),
            });
            expect(settings?.isOnboarded).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "successfully creates settings with minimal required fields",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "female",
                    allowsPhotosByDefault: false,
                    acceptsEventRules: true,
                    receiveMailCommunication: false,
                    allergies: [],
                },
            });

            expect(response.status).toBe(201);

            const json = await response.json();
            expect(json.gender).toBe("female");
            expect(json.allowsPhotosByDefault).toBe(false);
            expect(json.acceptsEventRules).toBe(true);
            expect(json.receiveMailCommunication).toBe(false);
            expect(json.allergies).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "returns 400 when user already has settings",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create existing settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "female",
                    allowsPhotosByDefault: true,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: [],
                },
            });

            expect(response.status).toBe(400);

            const json = (await response.json()) as unknown as { message: string };
            expect(json.message).toBe("User has already completed onboarding");
        },
        500_000,
    );

    integrationTest(
        "returns 401 for unauthenticated user during onboarding",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "male",
                    allowsPhotosByDefault: true,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: [],
                },
            });

            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "validates required fields during onboarding",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$post({
                json: {
                    // Missing required fields
                    gender: "male",
                    allowsPhotosByDefault: true,
                    // missing acceptsEventRules
                    receiveMailCommunication: true,
                    allergies: [],
                } as any,
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "validates URL format for imageUrl during onboarding",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "male",
                    allowsPhotosByDefault: true,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: [],
                    imageUrl: "not-a-valid-url",
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "validates URL format for githubUrl during onboarding",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "male",
                    allowsPhotosByDefault: true,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: [],
                    githubUrl: "invalid-github-url",
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "correctly associates allergies with user during onboarding",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create test allergies
            await db.insert(schema.allergy).values([
                {
                    slug: "lactose",
                    label: "Lactose Intolerance",
                    description: "Cannot digest lactose",
                },
                {
                    slug: "nuts",
                    label: "Nut Allergy",
                    description: "Allergic to nuts",
                },
            ]);

            const response = await client.api.user.me.settings.$post({
                json: {
                    gender: "other",
                    allowsPhotosByDefault: false,
                    acceptsEventRules: true,
                    receiveMailCommunication: true,
                    allergies: ["lactose", "nuts"],
                },
            });

            expect(response.status).toBe(201);

            // Verify allergies in database
            const userAllergies = await db.query.userAllergy.findMany({
                where: (ua, { eq }) => eq(ua.userId, user.id),
            });

            expect(userAllergies.length).toBe(2);
            expect(userAllergies.map((ua) => ua.allergySlug)).toEqual(
                expect.arrayContaining(["lactose", "nuts"]),
            );
        },
        500_000,
    );

    // ===== PATCH /api/user/me/settings (Update Settings) =====

    integrationTest(
        "successfully updates settings with partial data",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create existing settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: {
                    gender: "female",
                    bioDescription: "Updated bio",
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.gender).toBe("female");
            expect(json.bioDescription).toBe("Updated bio");
            // Other fields should remain unchanged
            expect(json.allowsPhotosByDefault).toBe(false);
            expect(json.acceptsEventRules).toBe(true);
            expect(json.receiveMailCommunication).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "returns 404 when user hasn't onboarded",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$patch({
                json: {
                    gender: "female",
                },
            });

            expect(response.status).toBe(404);

            const json = (await response.json()) as unknown as { message: string };
            expect(json.message).toBe(
                "User settings not found. Please complete onboarding first.",
            );
        },
        500_000,
    );

    integrationTest(
        "returns 401 for unauthenticated user when updating settings",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.user.me.settings.$patch({
                json: {
                    gender: "female",
                },
            });

            expect(response.status).toBe(401);
        },
        500_000,
    );

    integrationTest(
        "updates only provided fields",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create existing settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: true,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
                bioDescription: "Original bio",
                githubUrl: "https://github.com/original",
            });

            const response = await client.api.user.me.settings.$patch({
                json: {
                    allowsPhotosByDefault: false,
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.allowsPhotosByDefault).toBe(false);
            expect(json.gender).toBe("male");
            expect(json.bioDescription).toBe("Original bio");
            expect(json.githubUrl).toBe("https://github.com/original");
        },
        500_000,
    );

    integrationTest(
        "updates allergies array (replaces existing)",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create test allergies
            await db.insert(schema.allergy).values([
                {
                    slug: "lactose",
                    label: "Lactose Intolerance",
                    description: "Cannot digest lactose",
                },
                {
                    slug: "gluten",
                    label: "Gluten Intolerance",
                    description: "Cannot digest gluten",
                },
                {
                    slug: "nuts",
                    label: "Nut Allergy",
                    description: "Allergic to nuts",
                },
            ]);

            // Create existing settings with lactose allergy
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });

            await db.insert(schema.userAllergy).values({
                userId: user.id,
                allergySlug: "lactose",
            });

            // Update to gluten and nuts allergies
            const response = await client.api.user.me.settings.$patch({
                json: {
                    allergies: ["gluten", "nuts"],
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.allergies).toEqual(
                expect.arrayContaining(["gluten", "nuts"]),
            );
            expect(json.allergies.length).toBe(2);

            // Verify in database
            const userAllergies = await db.query.userAllergy.findMany({
                where: (ua, { eq }) => eq(ua.userId, user.id),
            });

            expect(userAllergies.length).toBe(2);
            expect(userAllergies.map((ua) => ua.allergySlug)).toEqual(
                expect.arrayContaining(["gluten", "nuts"]),
            );
        },
        500_000,
    );

    integrationTest(
        "validates gender enum values during update",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create existing settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: {
                    gender: "invalid-gender" as any,
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "validates URL format when updating URLs",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create existing settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: {
                    linkedinUrl: "not-a-valid-url",
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "successfully updates multiple fields at once",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // Create test allergies
            await db.insert(schema.allergy).values([
                {
                    slug: "lactose",
                    label: "Lactose Intolerance",
                    description: "Cannot digest lactose",
                },
            ]);

            // Create existing settings
            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });

            const response = await client.api.user.me.settings.$patch({
                json: {
                    gender: "female",
                    allowsPhotosByDefault: true,
                    bioDescription: "Multi-field update",
                    githubUrl: "https://github.com/multiupdate",
                    allergies: ["lactose"],
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.gender).toBe("female");
            expect(json.allowsPhotosByDefault).toBe(true);
            expect(json.bioDescription).toBe("Multi-field update");
            expect(json.githubUrl).toBe("https://github.com/multiupdate");
            expect(json.allergies).toEqual(["lactose"]);
        },
        500_000,
    );
});
