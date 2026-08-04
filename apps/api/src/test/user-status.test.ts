import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * PATCH /api/user/:id/status — deactivating and reactivating a member.
 *
 * Deactivation writes Better Auth's own `banned` column, which is what blocks
 * sign-in, and drops the member's sessions so it takes hold immediately rather
 * than whenever the current session happens to expire.
 */
describe("PATCH /api/user/:id/status", () => {
    integrationTest("requires users:manage", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(caller, ["users:view"]);
        const client = await ctx.utils.clientForUser(caller);

        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"].status.$patch({
            param: { id: target.id },
            json: { isActive: false },
        });

        expect(res.status).toBe(403);
    });

    integrationTest(
        "deactivating bans the member and ends their sessions",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();
            // Signing in gives the target a session, which deactivation has to
            // clear — otherwise they keep their access until it expires.
            await ctx.utils.clientForUser(target);

            const before = await ctx.db
                .select()
                .from(schema.session)
                .where(eq(schema.session.userId, target.id));
            expect(before.length).toBeGreaterThan(0);

            const res = await client.api.user[":id"].status.$patch({
                param: { id: target.id },
                json: { isActive: false, reason: "Testet ut" },
            });

            expect(res.status).toBe(200);

            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, target.id));
            expect(row?.banned).toBe(true);
            expect(row?.banReason).toBe("Testet ut");

            const after = await ctx.db
                .select()
                .from(schema.session)
                .where(eq(schema.session.userId, target.id));
            expect(after).toHaveLength(0);
        },
    );

    integrationTest("reactivating clears the ban", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const target = await ctx.utils.createTestUser();
        await ctx.db
            .update(schema.user)
            .set({ banned: true, banReason: "Tidligere" })
            .where(eq(schema.user.id, target.id));

        const res = await client.api.user[":id"].status.$patch({
            param: { id: target.id },
            json: { isActive: true },
        });

        expect(res.status).toBe(200);

        const [row] = await ctx.db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, target.id));
        expect(row?.banned).toBe(false);
        expect(row?.banReason).toBeNull();
    });

    integrationTest("refuses to deactivate yourself", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const res = await client.api.user[":id"].status.$patch({
            param: { id: admin.id },
            json: { isActive: false },
        });

        expect(res.status).toBe(400);

        const [row] = await ctx.db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, admin.id));
        expect(row?.banned).not.toBe(true);
    });

    integrationTest("404s for an unknown user", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:manage"]);
        const client = await ctx.utils.clientForUser(admin);

        const res = await client.api.user[":id"].status.$patch({
            param: { id: "does-not-exist" },
            json: { isActive: false },
        });

        expect(res.status).toBe(404);
    });
});
