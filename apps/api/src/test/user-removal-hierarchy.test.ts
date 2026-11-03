import { assignUserRole, createTestingRole } from "@photon/auth/roles";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

type TestUser = Awaited<
    ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
>;

const removalActions = {
    deactivate: async (
        ctx: IntegrationTestContext,
        actor: TestUser,
        id: string,
    ) => {
        const client = await ctx.utils.clientForUser(actor);
        return client.api.user[":id"].status.$patch({
            param: { id },
            json: { isActive: false },
        });
    },
    reactivate: async (
        ctx: IntegrationTestContext,
        actor: TestUser,
        id: string,
    ) => {
        const client = await ctx.utils.clientForUser(actor);
        return client.api.user[":id"].status.$patch({
            param: { id },
            json: { isActive: true },
        });
    },
    delete: async (
        ctx: IntegrationTestContext,
        actor: TestUser,
        id: string,
    ) => {
        const client = await ctx.utils.clientForUser(actor);
        return client.api.user[":id"].$delete({ param: { id } });
    },
};

const removalPermissions = ["users:manage", "users:delete"] as const;

async function userWithRole(
    ctx: IntegrationTestContext,
    name: string,
    position: number,
) {
    const user = await ctx.utils.createTestUser();
    await createTestingRole(ctx, {
        name,
        permissions: ["users:view"],
        description: "Role at a chosen position",
        position,
    });
    await assignUserRole(ctx, user.id, name);
    return user;
}

async function seedBaselineRole(
    ctx: IntegrationTestContext,
    name: "member" | "alumni",
    position: number,
) {
    const existing = await ctx.db.query.role.findFirst({ where: { name } });
    if (!existing) {
        await createTestingRole(ctx, {
            name,
            permissions: ["users:view"],
            description: "Baseline role",
            position,
        });
    }
}

describe("removing someone above you", () => {
    for (const [name, act] of Object.entries(removalActions)) {
        integrationTest(`${name}: root cannot be touched`, async ({ ctx }) => {
            const actor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(actor, [...removalPermissions]);

            const root = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(root, ["root"]);

            const res = await act(ctx, actor, root.id);

            expect(res.status).toBe(403);
            const [row] = await ctx.db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, root.id));
            expect(row).toBeDefined();
            expect(row?.banned).toBeFalsy();
        });

        integrationTest(
            `${name}: root held as a direct grant counts too`,
            async ({ ctx }) => {
                const actor = await ctx.utils.createTestUser();
                await ctx.utils.giveUserPermissions(actor, [
                    ...removalPermissions,
                ]);

                const root = await ctx.utils.createTestUser();
                await ctx.db.insert(schema.userPermission).values({
                    userId: root.id,
                    permission: "root",
                    scope: "*",
                });

                expect((await act(ctx, actor, root.id)).status).toBe(403);
            },
        );

        integrationTest(`${name}: root may act on root`, async ({ ctx }) => {
            const actor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(actor, ["root"]);
            const other = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(other, ["root"]);

            expect((await act(ctx, actor, other.id)).status).toBeLessThan(300);
        });
    }

    integrationTest(
        "a role placed higher than yours protects its holder",
        async ({ ctx }) => {
            const actor = await userWithRole(ctx, "lav", 5);
            await ctx.utils.giveUserPermissions(actor, ["users:manage"]);
            const target = await userWithRole(ctx, "hoy", 6);

            const res = await removalActions.deactivate(ctx, actor, target.id);

            expect(res.status).toBe(403);
        },
    );
});

describe("removing someone who is not above you", () => {
    integrationTest(
        "a peer holding the same permission can be deactivated",
        async ({ ctx }) => {
            const actor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(actor, ["users:manage"]);
            const peer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(peer, ["users:manage"]);

            const res = await removalActions.deactivate(ctx, actor, peer.id);

            expect(res.status).toBe(200);
        },
    );

    /**
     * `member` sits above `alumni` only by seed order. An admin who has
     * finished their degree holds `alumni`, and must keep being able to
     * deactivate an active student.
     */
    integrationTest(
        "a baseline role does not outrank anyone",
        async ({ ctx }) => {
            await seedBaselineRole(ctx, "alumni", 1);
            await seedBaselineRole(ctx, "member", 2);

            const actor = await ctx.utils.createTestUser();
            await assignUserRole(ctx, actor.id, "alumni");
            await ctx.db.insert(schema.userPermission).values({
                userId: actor.id,
                permission: "users:manage",
                scope: "*",
            });

            const target = await ctx.utils.createTestUser();
            await assignUserRole(ctx, target.id, "member");

            const res = await removalActions.deactivate(ctx, actor, target.id);

            expect(res.status).toBe(200);
        },
    );
});
