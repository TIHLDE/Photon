import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("user endpoints", () => {
    // ===== GET /api/user/allergy (List Allergies) =====

    integrationTest(
        "successfully retrieves all allergies",
        async ({ ctx }) => {
            const { db } = ctx;

            // Egne slugs: katalogen er ikke tom lenger — migrasjon 0074 setter
            // inn Mattilsynets 14 pluss kostholdskravene — så «gluten» og
            // «nuts» ville kollidert på primærnøkkelen.
            await db
                .insert(schema.allergy)
                .values([
                    {
                        slug: "test-lactose",
                        label: "Lactose Intolerance",
                        description: "Cannot digest lactose",
                    },
                    {
                        slug: "test-nuts",
                        label: "Nut Allergy",
                        description: "Allergic to nuts",
                    },
                ])
                .onConflictDoNothing();

            const client = ctx.utils.client();

            const response = await client.api.user.allergy.$get({ query: {} });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(Array.isArray(json)).toBe(true);
            expect(json.map((a) => a.slug)).toEqual(
                expect.arrayContaining(["test-lactose", "test-nuts"]),
            );
            expect(json[0]).toHaveProperty("slug");
            expect(json[0]).toHaveProperty("label");
            expect(json[0]).toHaveProperty("description");
        },
        500_000,
    );

    integrationTest(
        "ships the curated baseline every environment gets",
        async ({ ctx }) => {
            const client = ctx.utils.client();

            const response = await client.api.user.allergy.$get({
                query: { curated: "true" },
            });

            expect(response.status).toBe(200);

            // Erstatter en gammel «tom katalog»-test: katalogen er ikke tom
            // etter migrasjon 0074, og det er nettopp poenget — prod hadde
            // bare Lepton-fritekst, så nedtrekkslista sto med to valg.
            const json = await response.json();
            expect(json.map((a) => a.slug)).toEqual(
                expect.arrayContaining([
                    "gluten",
                    "shellfish",
                    "molluscs",
                    "eggs",
                    "fish",
                    "peanuts",
                    "soy",
                    "milk",
                    "nuts",
                    "celery",
                    "mustard",
                    "sesame",
                    "sulfites",
                    "lupin",
                ]),
            );
            // Mattilsynets eksempler er det som gjør at folk kjenner igjen
            // sitt eget, så de skal faktisk følge med.
            const fish = json.find((a) => a.slug === "fish");
            expect(fish?.description).toContain("worcestersaus");
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
            await db
                .insert(schema.allergy)
                .values([
                    {
                        slug: "lactose",
                        label: "Lactose Intolerance",
                        description: "Cannot digest lactose",
                    },
                ])
                .onConflictDoNothing();

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

            const json = (await response.json()) as unknown as {
                message: string;
            };
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
            await db
                .insert(schema.allergy)
                .values([
                    {
                        slug: "gluten",
                        label: "Gluten Intolerance",
                        description: "Cannot digest gluten",
                    },
                ])
                .onConflictDoNothing();

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

            const json = (await response.json()) as unknown as {
                message: string;
            };
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
            await db
                .insert(schema.allergy)
                .values([
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
                ])
                .onConflictDoNothing();

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
        "creates settings when user hasn't onboarded",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // A member who never onboarded must still be able to accept the
            // event rules — otherwise they cannot register for anything.
            const response = await client.api.user.me.settings.$patch({
                json: {
                    acceptsEventRules: true,
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.acceptsEventRules).toBe(true);

            const settings = await ctx.db.query.userSettings.findFirst({
                where: (s, { eq }) => eq(s.userId, user.id),
            });
            // The placeholder row is not a completed onboarding.
            expect(settings?.isOnboarded).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "lets a user onboard after accepting the event rules",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await client.api.user.me.settings.$patch({
                json: { acceptsEventRules: true },
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

            expect(response.status).toBe(201);

            const json = await response.json();
            expect(json.gender).toBe("female");
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
            await db
                .insert(schema.allergy)
                .values([
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
                ])
                .onConflictDoNothing();

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
        "clears a profile link when an empty string is sent",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
                githubUrl: "https://github.com/testuser",
                linkedinUrl: "https://linkedin.com/in/testuser",
            });

            const response = await client.api.user.me.settings.$patch({
                json: { githubUrl: "" },
            });

            expect(response.status).toBe(200);

            const settings = await db.query.userSettings.findFirst({
                where: eq(schema.userSettings.userId, user.id),
            });

            // Tømt felt lagres som NULL, ikke tom streng — og feltene som ikke
            // ble sendt med står urørt.
            expect(settings?.githubUrl).toBeNull();
            expect(settings?.linkedinUrl).toBe(
                "https://linkedin.com/in/testuser",
            );
        },
        500_000,
    );

    integrationTest(
        "clears the profile picture when an empty string is sent",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "male",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
                imageUrl: "https://example.com/avatar.webp",
            });

            const response = await client.api.user.me.settings.$patch({
                json: { imageUrl: "" },
            });

            expect(response.status).toBe(200);

            const settings = await db.query.userSettings.findFirst({
                where: eq(schema.userSettings.userId, user.id),
            });

            // NULL, ikke tom streng: profilen faller da tilbake på bildet fra
            // Feide, som er hele poenget med å kunne fjerne sitt eget.
            expect(settings?.imageUrl).toBeNull();
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
            await db
                .insert(schema.allergy)
                .values([
                    {
                        slug: "lactose",
                        label: "Lactose Intolerance",
                        description: "Cannot digest lactose",
                    },
                ])
                .onConflictDoNothing();

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

    // ===== Allergier: fritekst og bekreftelse =====

    integrationTest(
        "stores free-text allergies without adding catalogue rows",
        async ({ ctx }) => {
            const { db } = ctx;
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const before = await db.select().from(schema.allergy);

            const response = await client.api.user.me.settings.$patch({
                json: {
                    customAllergies: ["Reagerer på sennep", "Bringebær"],
                },
            });

            expect(response.status).toBe(200);
            const json = await response.json();
            expect(json.customAllergies).toEqual([
                "Reagerer på sennep",
                "Bringebær",
            ]);

            // Dette er hele poenget med å lagre fritekst på brukeren: katalogen
            // skal ikke vokse med én rad per svar, slik Lepton-importen gjorde.
            const after = await db.select().from(schema.allergy);
            expect(after.length).toBe(before.length);
        },
        500_000,
    );

    integrationTest(
        "normalises free-text allergies before storing them",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$patch({
                json: {
                    customAllergies: ["  Nøtter  ", "nøtter", "Sterk    mat"],
                },
            });

            expect(response.status).toBe(200);
            const json = await response.json();
            // Duplikatet forsvinner uansett skrivemåte, og mellomrom kollapser
            // — ellers ville arrangørens opptelling splittet dem i to linjer.
            expect(json.customAllergies).toEqual(["Nøtter", "Sterk mat"]);
        },
        500_000,
    );

    integrationTest(
        "rejects more than 15 free-text allergies",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$patch({
                json: {
                    customAllergies: Array.from(
                        { length: 16 },
                        (_, i) => `Allergi ${i}`,
                    ),
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "saving an empty allergy list counts as an answer",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.user.me.settings.$patch({
                json: { allergies: [], customAllergies: [] },
            });

            expect(response.status).toBe(200);
            const json = await response.json();
            // «Jeg har ingen allergier» er et svar. Uten dette kan ikke en
            // arrangør skille de allergifrie fra dem som aldri har sett
            // spørsmålet.
            expect(json.allergiesConfirmedAt).not.toBeNull();
        },
        500_000,
    );

    integrationTest(
        "an update without allergy fields leaves the confirmation alone",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const untouched = await client.api.user.me.settings.$patch({
                json: { bioDescription: "Har ikke svart ennå" },
            });

            expect(untouched.status).toBe(200);
            expect((await untouched.json()).allergiesConfirmedAt).toBeNull();

            await client.api.user.me.settings.$patch({
                json: { allergies: [] },
            });

            const later = await client.api.user.me.settings.$patch({
                json: { bioDescription: "Har svart nå" },
            });

            expect((await later.json()).allergiesConfirmedAt).not.toBeNull();
        },
        500_000,
    );

    integrationTest(
        "an admin filling in allergies is not a confirmation from the member",
        async ({ ctx }) => {
            const { db } = ctx;
            await db
                .insert(schema.allergy)
                .values({
                    slug: "lactose",
                    label: "Laktose",
                })
                .onConflictDoNothing();

            const member = await ctx.utils.createTestUser();
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const adminClient = await ctx.utils.clientForUser(admin);

            const response = await adminClient.api.user[":id"].allergies.$put({
                param: { id: member.id },
                json: { allergies: ["lactose"] },
            });

            expect(response.status).toBe(200);

            // Arrangøren skal fortsatt se at medlemmet ikke har svart selv.
            const settings = await db.query.userSettings.findFirst({
                where: eq(schema.userSettings.userId, member.id),
            });
            expect(settings?.allergiesConfirmedAt).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "curated=true excludes the free-text rows the migration imported",
        async ({ ctx }) => {
            const { db } = ctx;
            await db
                .insert(schema.allergy)
                .values({ slug: "reagerer-pa-alt", label: "reagerer på alt" })
                .onConflictDoNothing();

            const client = ctx.utils.client();

            const all = await client.api.user.allergy.$get({ query: {} });
            const curated = await client.api.user.allergy.$get({
                query: { curated: "true" },
            });

            expect(curated.status).toBe(200);
            const allSlugs = (await all.json()).map((a) => a.slug);
            const curatedSlugs = (await curated.json()).map((a) => a.slug);

            // Fritekstraden er med i hele katalogen, men ikke i lista et
            // medlem velger fra — det er hele grunnen til flagget.
            expect(allSlugs).toContain("reagerer-pa-alt");
            expect(curatedSlugs).not.toContain("reagerer-pa-alt");
            expect(curatedSlugs).toContain("gluten");
        },
        500_000,
    );
});
