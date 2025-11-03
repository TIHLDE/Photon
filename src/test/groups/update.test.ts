import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("update group", () => {
    integrationTest(
        "successfully updates a group with valid permissions",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.giveUserPermissions(user, ["groups:update"]);

            const group = await ctx.utils.createTestGroup({
                slug: "update-test",
                name: "Original Name",
            });

            const response = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: {
                    name: "Updated Name",
                    description: "Updated description",
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.message).toBe("Group updated successfully");
        },
        500_000,
    );

    integrationTest(
        "fails to update group without groups:update permission",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const group = await ctx.utils.createTestGroup({
                slug: "no-permission-update",
            });

            const response = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: {
                    name: "Should Fail",
                },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "returns 404 when updating non-existent group",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.giveUserPermissions(user, ["groups:update"]);

            const response = await client.api.groups[":slug"].$patch({
                param: { slug: "non-existent" },
                json: {
                    name: "Should 404",
                },
            });

            expect(response.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "successfully updates fines settings",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.giveUserPermissions(user, ["groups:update"]);

            const group = await ctx.utils.createTestGroup({
                slug: "fines-update-test",
                finesActivated: false,
            });

            const response = await client.api.groups[":slug"].$patch({
                param: { slug: group.slug },
                json: {
                    finesActivated: true,
                    finesInfo: "New fines policy",
                    finesAdminId: user.id,
                },
            });

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.message).toBe("Group updated successfully");
        },
        500_000,
    );
});
