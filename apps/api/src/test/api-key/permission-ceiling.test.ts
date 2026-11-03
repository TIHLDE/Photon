import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import { createApiKeyService } from "~/lib/service/api-key";

const keyInput = (permissions: string[]) => ({
    name: "Testnøkkel",
    description: "Brukt i test",
    permissions,
});

const clientWith = async (
    ctx: IntegrationTestContext,
    permissions: Parameters<
        IntegrationTestContext["utils"]["giveUserPermissions"]
    >[1],
) => {
    const user = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(user, permissions);
    return { user, client: await ctx.utils.clientForUser(user) };
};

describe("creating an API key", () => {
    integrationTest("refuses permissions the caller lacks", async ({ ctx }) => {
        const { client } = await clientWith(ctx, ["api-keys:create"]);

        for (const permissions of [["root"], ["users:view"], ["email:send"]]) {
            const res = await client.api["api-keys"].$post({
                json: keyInput(permissions),
            });
            expect(res.status).toBe(403);
        }

        expect(await ctx.db.select().from(schema.managedApiKey)).toHaveLength(
            0,
        );
    });

    integrationTest("refuses a mix with one it lacks", async ({ ctx }) => {
        const { client } = await clientWith(ctx, [
            "api-keys:create",
            "users:view",
        ]);

        const res = await client.api["api-keys"].$post({
            json: keyInput(["users:view", "users:create"]),
        });

        expect(res.status).toBe(403);
    });

    integrationTest(
        "a permission held for one group is not enough",
        async ({ ctx }) => {
            const { user, client } = await clientWith(ctx, ["api-keys:create"]);
            await ctx.db.insert(schema.userPermission).values({
                userId: user.id,
                permission: "users:view",
                scope: "group:noen",
            });

            const res = await client.api["api-keys"].$post({
                json: keyInput(["users:view"]),
            });

            expect(res.status).toBe(403);
        },
    );

    integrationTest("allows permissions the caller holds", async ({ ctx }) => {
        const { client } = await clientWith(ctx, [
            "api-keys:create",
            "users:view",
        ]);

        const res = await client.api["api-keys"].$post({
            json: keyInput(["users:view"]),
        });

        expect(res.status).toBe(201);
    });

    integrationTest("root may grant anything", async ({ ctx }) => {
        const { client } = await clientWith(ctx, ["root"]);

        const res = await client.api["api-keys"].$post({
            json: keyInput(["root", "email:send", "users:create"]),
        });

        expect(res.status).toBe(201);
    });
});

describe("changing an existing API key", () => {
    const rootKey = (ctx: IntegrationTestContext) =>
        createApiKeyService(ctx).create(keyInput(["root"]));

    integrationTest("refuses adding what the caller lacks", async ({ ctx }) => {
        const { client } = await clientWith(ctx, [
            "api-keys:update",
            "users:view",
        ]);
        const key = await createApiKeyService(ctx).create(
            keyInput(["users:view"]),
        );

        const res = await client.api["api-keys"][":id"].$patch({
            param: { id: key.id },
            json: { permissions: ["users:view", "root"] },
        });

        expect(res.status).toBe(403);
        const [row] = await ctx.db
            .select()
            .from(schema.managedApiKey)
            .where(eq(schema.managedApiKey.id, key.id));
        expect(JSON.parse(row?.permissions ?? "")).toEqual(["users:view"]);
    });

    integrationTest(
        "refuses replacing the permissions of a key above the caller",
        async ({ ctx }) => {
            const { client } = await clientWith(ctx, [
                "api-keys:update",
                "users:view",
            ]);
            const key = await rootKey(ctx);

            const res = await client.api["api-keys"][":id"].$patch({
                param: { id: key.id },
                json: { permissions: ["users:view"] },
            });

            expect(res.status).toBe(403);
        },
    );

    integrationTest(
        "lets the caller rename a key above them",
        async ({ ctx }) => {
            const { client } = await clientWith(ctx, ["api-keys:update"]);
            const key = await rootKey(ctx);

            const res = await client.api["api-keys"][":id"].$patch({
                param: { id: key.id },
                json: { name: "Nytt navn" },
            });

            expect(res.status).toBe(200);
        },
    );

    integrationTest(
        "refuses handing the caller a fresh copy of a key above them",
        async ({ ctx }) => {
            const { client } = await clientWith(ctx, ["api-keys:update"]);
            const key = await rootKey(ctx);

            const res = await client.api["api-keys"][":id"].regenerate.$post({
                param: { id: key.id },
            });

            expect(res.status).toBe(403);
            const validated = await createApiKeyService(ctx).validate(key.key);
            expect(validated.valid).toBe(true);
        },
    );

    integrationTest(
        "lets the caller regenerate a key they could have made",
        async ({ ctx }) => {
            const { client } = await clientWith(ctx, [
                "api-keys:update",
                "users:view",
            ]);
            const key = await createApiKeyService(ctx).create(
                keyInput(["users:view"]),
            );

            const res = await client.api["api-keys"][":id"].regenerate.$post({
                param: { id: key.id },
            });

            expect(res.status).toBe(200);
        },
    );

    integrationTest(
        "a leaked key above the caller can still be deleted",
        async ({ ctx }) => {
            const { client } = await clientWith(ctx, ["api-keys:delete"]);
            const key = await rootKey(ctx);

            const res = await client.api["api-keys"][":id"].$delete({
                param: { id: key.id },
            });

            expect(res.status).toBe(200);
        },
    );
});
