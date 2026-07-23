import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Banner System", () => {
    integrationTest(
        "Complete banner lifecycle: create, list, visible, update, delete",
        async ({ ctx }) => {
            // Setup users with different permissions
            const admin = await ctx.utils.createTestUser();
            const editor = await ctx.utils.createTestUser();
            const regularUser = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, ["banners:manage"]);
            await ctx.utils.giveUserPermissions(editor, [
                "banners:view",
                "banners:create",
                "banners:update",
            ]);

            const adminClient = await ctx.utils.clientForUser(admin);
            const editorClient = await ctx.utils.clientForUser(editor);
            const userClient = await ctx.utils.clientForUser(regularUser);

            const now = Date.now();
            const HOUR = 60 * 60 * 1000;

            // === CREATE ===

            // 1. Editor creates a live banner
            const createResponse = await editorClient.api.banners.$post({
                json: {
                    title: "Live Banner",
                    description: "Currently visible on the front page",
                    visibleFrom: new Date(now - HOUR).toISOString(),
                    visibleUntil: new Date(now + HOUR).toISOString(),
                },
            });

            expect(createResponse.status).toBe(201);
            const liveBanner = await createResponse.json();
            expect(liveBanner.title).toBe("Live Banner");
            expect(liveBanner.isVisible).toBe(true);
            expect(liveBanner.createdById).toBe(editor.id);

            // 2. Regular user cannot create a banner
            const unauthorizedCreateResponse =
                await userClient.api.banners.$post({
                    json: {
                        title: "Unauthorized",
                        description: "Should fail",
                        visibleFrom: new Date(now).toISOString(),
                        visibleUntil: new Date(now + HOUR).toISOString(),
                    },
                });

            expect(unauthorizedCreateResponse.status).toBe(403);

            // 3. Rejects an inverted visibility window
            const invalidWindowResponse = await editorClient.api.banners.$post({
                json: {
                    title: "Invalid",
                    description: "Window ends before it starts",
                    visibleFrom: new Date(now + HOUR).toISOString(),
                    visibleUntil: new Date(now).toISOString(),
                },
            });

            expect(invalidWindowResponse.status).toBe(400);

            // 4. Create a scheduled (not yet visible) banner
            const scheduledResponse = await adminClient.api.banners.$post({
                json: {
                    title: "Scheduled Banner",
                    description: "Visible in the future",
                    url: "https://tihlde.org",
                    visibleFrom: new Date(now + HOUR).toISOString(),
                    visibleUntil: new Date(now + 2 * HOUR).toISOString(),
                },
            });

            expect(scheduledResponse.status).toBe(201);
            const scheduledBanner = await scheduledResponse.json();
            expect(scheduledBanner.isVisible).toBe(false);
            expect(scheduledBanner.url).toBe("https://tihlde.org");

            // === LIST (admin) ===

            // 5. Editor with banners:view sees every banner
            const listResponse = await editorClient.api.banners.$get();
            expect(listResponse.status).toBe(200);
            const allBanners = await listResponse.json();
            expect(allBanners.length).toBe(2);

            // 6. Regular user cannot list all banners
            const unauthorizedListResponse =
                await userClient.api.banners.$get();
            expect(unauthorizedListResponse.status).toBe(403);

            // === VISIBLE (public) ===

            // 7. Anyone (unauthenticated) sees only the live banner
            const publicClient = ctx.utils.client();
            const visibleResponse =
                await publicClient.api.banners.visible.$get();
            expect(visibleResponse.status).toBe(200);
            const visibleBanners = await visibleResponse.json();
            expect(visibleBanners.length).toBe(1);
            expect(visibleBanners[0]?.title).toBe("Live Banner");

            // === UPDATE ===

            // 8. Editor updates a banner
            const updateResponse = await editorClient.api.banners[":id"].$patch(
                {
                    param: { id: liveBanner.id },
                    json: { title: "Updated Live Banner" },
                },
            );

            expect(updateResponse.status).toBe(200);
            const updatedBanner = await updateResponse.json();
            expect(updatedBanner.title).toBe("Updated Live Banner");

            // 9. Update rejects an inverted window against stored values
            const invalidUpdateResponse = await editorClient.api.banners[
                ":id"
            ].$patch({
                param: { id: liveBanner.id },
                json: {
                    visibleFrom: new Date(now + 3 * HOUR).toISOString(),
                },
            });

            expect(invalidUpdateResponse.status).toBe(400);

            // 10. Regular user cannot update
            const unauthorizedUpdateResponse = await userClient.api.banners[
                ":id"
            ].$patch({
                param: { id: liveBanner.id },
                json: { title: "Should fail" },
            });

            expect(unauthorizedUpdateResponse.status).toBe(403);

            // 11. 404 for non-existent banner
            const notFoundUpdateResponse = await editorClient.api.banners[
                ":id"
            ].$patch({
                param: { id: "00000000-0000-0000-0000-000000000000" },
                json: { title: "Nope" },
            });

            expect(notFoundUpdateResponse.status).toBe(404);

            // === DELETE ===

            // 12. Editor without banners:delete cannot delete
            const forbiddenDeleteResponse = await editorClient.api.banners[
                ":id"
            ].$delete({
                param: { id: liveBanner.id },
            });

            expect(forbiddenDeleteResponse.status).toBe(403);

            // 13. Admin (banners:manage) can delete
            const deleteResponse = await adminClient.api.banners[":id"].$delete(
                {
                    param: { id: liveBanner.id },
                },
            );

            expect(deleteResponse.status).toBe(200);

            // 14. Deleted banner is gone from the public endpoint
            const visibleAfterDeleteResponse =
                await publicClient.api.banners.visible.$get();
            const visibleAfterDelete = await visibleAfterDeleteResponse.json();
            expect(visibleAfterDelete.length).toBe(0);

            // 15. Deleting again returns 404
            const deleteAgainResponse = await adminClient.api.banners[
                ":id"
            ].$delete({
                param: { id: liveBanner.id },
            });

            expect(deleteAgainResponse.status).toBe(404);
        },
        120_000,
    );
});
