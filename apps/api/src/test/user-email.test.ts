import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * PATCH /api/user/:id/email — root changing a member's address.
 *
 * The address is the login and where resets go, so changing it is an account
 * takeover in all but name: `users:manage` is not enough.
 */
describe("PATCH /api/user/:id/email", () => {
    integrationTest("refuses users:manage without root", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, [
            "users:manage",
            "users:update",
        ]);
        const client = await ctx.utils.clientForUser(caller);
        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"].email.$patch({
            param: { id: target.id },
            json: { email: "ny@example.com" },
        });

        expect(res.status).toBe(403);

        const [row] = await ctx.db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, target.id));
        expect(row?.email).toBe(target.email);
    });

    integrationTest(
        "root changes the address and marks it verified",
        async ({ ctx }) => {
            const root = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(root, ["root"]);
            const client = await ctx.utils.clientForUser(root);

            const target = await ctx.utils.createTestUser();
            await ctx.db
                .update(schema.user)
                .set({ emailVerified: false })
                .where(eq(schema.user.id, target.id));

            const res = await client.api.user[":id"].email.$patch({
                param: { id: target.id },
                json: { email: "  Ny.Adresse@Example.com " },
            });

            expect(res.status).toBe(200);
            expect((await res.json()).email).toBe("ny.adresse@example.com");

            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, target.id));
            expect(row?.email).toBe("ny.adresse@example.com");
            expect(row?.emailVerified).toBe(true);
        },
    );

    integrationTest(
        "409s when another account has the address",
        async ({ ctx }) => {
            const root = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(root, ["root"]);
            const client = await ctx.utils.clientForUser(root);

            const target = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();

            const res = await client.api.user[":id"].email.$patch({
                param: { id: target.id },
                json: { email: other.email },
            });

            expect(res.status).toBe(409);
        },
    );

    integrationTest(
        "allows setting the address it already has",
        async ({ ctx }) => {
            const root = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(root, ["root"]);
            const client = await ctx.utils.clientForUser(root);
            const target = await ctx.utils.createTestUser();

            const res = await client.api.user[":id"].email.$patch({
                param: { id: target.id },
                json: { email: target.email },
            });

            expect(res.status).toBe(200);
        },
    );

    integrationTest("rejects an invalid address", async ({ ctx }) => {
        const root = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(root, ["root"]);
        const client = await ctx.utils.clientForUser(root);
        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"].email.$patch({
            param: { id: target.id },
            json: { email: "ikke-en-adresse" },
        });

        expect(res.status).toBe(400);
    });

    integrationTest("404s for an unknown user", async ({ ctx }) => {
        const root = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(root, ["root"]);
        const client = await ctx.utils.clientForUser(root);

        const res = await client.api.user[":id"].email.$patch({
            param: { id: "does-not-exist" },
            json: { email: "ny@example.com" },
        });

        expect(res.status).toBe(404);
    });
});
