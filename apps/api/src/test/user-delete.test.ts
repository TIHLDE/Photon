import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * DELETE /api/user/:id — removing an account for good.
 *
 * The destructive counterpart to `PATCH /api/user/:id/status`: everything
 * hanging off the user goes with the row, so the tests below check both that
 * the cascade actually runs and that the one non-cascading reference
 * (`group.fines_admin_id`) does not abort it.
 */
describe("DELETE /api/user/:id", () => {
    integrationTest("requires users:delete", async ({ ctx }) => {
        const caller = await ctx.utils.createTestUser();
        // `users:manage` is enough to deactivate, deliberately not to delete.
        await ctx.utils.giveUserPermissions(caller, ["users:manage"]);
        const client = await ctx.utils.clientForUser(caller);

        const target = await ctx.utils.createTestUser();

        const res = await client.api.user[":id"].$delete({
            param: { id: target.id },
        });

        expect(res.status).toBe(403);

        const [row] = await ctx.db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, target.id));
        expect(row).toBeDefined();
    });

    integrationTest(
        "deletes the account and its memberships",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:delete"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup();
            await ctx.db.insert(schema.groupMembership).values({
                userId: target.id,
                groupSlug: group.slug,
                role: "member",
            });

            const res = await client.api.user[":id"].$delete({
                param: { id: target.id },
            });

            expect(res.status).toBe(204);

            const rows = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, target.id));
            expect(rows).toHaveLength(0);

            const memberships = await ctx.db
                .select()
                .from(schema.groupMembership)
                .where(eq(schema.groupMembership.userId, target.id));
            expect(memberships).toHaveLength(0);
        },
    );

    integrationTest(
        "clears the group's fines admin instead of failing",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["users:delete"]);
            const client = await ctx.utils.clientForUser(admin);

            const target = await ctx.utils.createTestUser();
            const group = await ctx.utils.createTestGroup({
                finesActivated: true,
                finesAdminId: target.id,
            });

            const res = await client.api.user[":id"].$delete({
                param: { id: target.id },
            });

            expect(res.status).toBe(204);

            const [row] = await ctx.db
                .select()
                .from(schema.group)
                .where(eq(schema.group.slug, group.slug));
            expect(row?.finesAdminId).toBeNull();
        },
    );

    integrationTest("refuses to delete yourself", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:delete"]);
        const client = await ctx.utils.clientForUser(admin);

        const res = await client.api.user[":id"].$delete({
            param: { id: admin.id },
        });

        expect(res.status).toBe(400);

        const [row] = await ctx.db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, admin.id));
        expect(row).toBeDefined();
    });

    integrationTest("404s for an unknown user", async ({ ctx }) => {
        const admin = await ctx.utils.createTestUser();
        await ctx.utils.giveUserPermissions(admin, ["users:delete"]);
        const client = await ctx.utils.clientForUser(admin);

        const res = await client.api.user[":id"].$delete({
            param: { id: "does-not-exist" },
        });

        expect(res.status).toBe(404);
    });
});
