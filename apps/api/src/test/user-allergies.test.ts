import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * GET/PUT /api/user/:id/allergies — correcting a member's allergies for them.
 *
 * Allergies are the one setting someone else has to be able to fix, because
 * arrangører order food from them. Everything else about a profile stays the
 * member's own answer.
 */

const seedAllergies = async (db: IntegrationTestContext["db"]) => {
    await db
        .insert(schema.allergy)
        .values([
            { slug: "egg", label: "Egg" },
            { slug: "notter", label: "Nøtter" },
        ])
        .onConflictDoNothing();
};

describe("PUT /api/user/:id/allergies", () => {
    integrationTest("requires users:manage", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, ["users:view"]);
        const client = await ctx.utils.clientForUser(caller);

        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"].allergies.$put({
            param: { id: target.id },
            json: { allergies: [] },
        });

        expect(res.status).toBe(403);
    });

    integrationTest(
        "sets allergies for a member who never onboarded",
        async ({ ctx }) => {
            // The interesting case: `user_setting_allergy` points at the
            // settings row, not at the user, and most members migrated from
            // Lepton have no settings row at all.
            await seedAllergies(ctx.db);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();

            const res = await client.api.user[":id"].allergies.$put({
                param: { id: target.id },
                json: { allergies: ["egg", "notter"] },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.allergies.map((a) => a.slug).sort()).toEqual([
                "egg",
                "notter",
            ]);

            // The placeholder row is recognisable as "never answered".
            const [settings] = await ctx.db
                .select()
                .from(schema.userSettings)
                .where(eq(schema.userSettings.userId, target.id));
            expect(settings?.isOnboarded).toBe(false);
        },
    );

    integrationTest("replaces the previous set", async ({ ctx }) => {
        await seedAllergies(ctx.db);

        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const target = await ctx.utils.createTestUser();

        await client.api.user[":id"].allergies.$put({
            param: { id: target.id },
            json: { allergies: ["egg", "notter"] },
        });

        const res = await client.api.user[":id"].allergies.$put({
            param: { id: target.id },
            json: { allergies: ["egg"] },
        });

        expect(res.status).toBe(200);

        const read = await client.api.user[":id"].allergies.$get({
            param: { id: target.id },
        });
        const body = await read.json();
        expect(body.allergies.map((a) => a.slug)).toEqual(["egg"]);
    });

    integrationTest("rejects an unknown allergy", async ({ ctx }) => {
        await seedAllergies(ctx.db);

        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const target = await ctx.utils.createTestUser();
        await client.api.user[":id"].allergies.$put({
            param: { id: target.id },
            json: { allergies: ["egg"] },
        });

        const res = await client.api.user[":id"].allergies.$put({
            param: { id: target.id },
            json: { allergies: ["egg", "finnes-ikke"] },
        });

        expect(res.status).toBe(400);

        // Checked before the write, so the previous set survives the attempt.
        const read = await client.api.user[":id"].allergies.$get({
            param: { id: target.id },
        });
        const body = await read.json();
        expect(body.allergies.map((a) => a.slug)).toEqual(["egg"]);
    });

    integrationTest(
        "leaves an existing settings row untouched",
        async ({ ctx }) => {
            await seedAllergies(ctx.db);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.userSettings).values({
                userId: target.id,
                gender: "female",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: false,
                isOnboarded: true,
            });

            await client.api.user[":id"].allergies.$put({
                param: { id: target.id },
                json: { allergies: ["egg"] },
            });

            const [settings] = await ctx.db
                .select()
                .from(schema.userSettings)
                .where(eq(schema.userSettings.userId, target.id));
            expect(settings?.gender).toBe("female");
            expect(settings?.acceptsEventRules).toBe(true);
            expect(settings?.isOnboarded).toBe(true);
        },
    );
});
