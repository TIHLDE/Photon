import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("News System", () => {
    integrationTest(
        "Complete news lifecycle: create, list, get, update, delete, reactions",
        async ({ ctx }) => {
            // Setup users with different permissions
            const admin = await ctx.utils.createTestUser();
            const editor = await ctx.utils.createTestUser();
            const creator = await ctx.utils.createTestUser();
            const regularUser = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(admin, ["news:manage"]);
            await ctx.utils.giveUserPermissions(editor, [
                "news:create",
                "news:update",
            ]);
            await ctx.utils.giveUserPermissions(creator, ["news:create"]);

            const adminClient = await ctx.utils.clientForUser(admin);
            const editorClient = await ctx.utils.clientForUser(editor);
            const creatorClient = await ctx.utils.clientForUser(creator);
            const userClient = await ctx.utils.clientForUser(regularUser);

            // === CREATE NEWS ===

            // 1. Creator creates news article
            const createResponse = await creatorClient.api.news.$post({
                json: {
                    title: "Breaking News",
                    header: "Important announcement for students",
                    body: "This is a detailed news article about upcoming events.",
                    emojisAllowed: true,
                },
            });

            expect(createResponse.status).toBe(201);
            const newsArticle = await createResponse.json();
            expect(newsArticle.title).toBe("Breaking News");
            expect(newsArticle.createdById).toBe(creator.id);

            // 2. Regular user cannot create news without permission
            const unauthorizedCreateResponse = await userClient.api.news.$post({
                json: {
                    title: "Unauthorized News",
                    header: "Should fail",
                    body: "This should not be created",
                    emojisAllowed: false,
                },
            });

            expect(unauthorizedCreateResponse.status).toBe(403);

            // 3. Create news with image
            const newsWithImageResponse = await editorClient.api.news.$post({
                json: {
                    title: "News with Image",
                    header: "Visual content",
                    body: "Article with accompanying image",
                    imageUrl: "https://example.com/image.jpg",
                    imageAlt: "Example image",
                    emojisAllowed: false,
                },
            });

            expect(newsWithImageResponse.status).toBe(201);
            const newsWithImage = await newsWithImageResponse.json();
            expect(newsWithImage.imageUrl).toBe(
                "https://example.com/image.jpg",
            );

            // === LIST NEWS ===

            // 4. Anyone can list news (public endpoint)
            const listResponse = await userClient.api.news.$get({ query: {} });
            expect(listResponse.status).toBe(200);
            const newsList = await listResponse.json();
            expect(newsList.items.length).toBeGreaterThanOrEqual(2);

            // Verify newest first (ordered by -createdAt)
            expect(newsList.items[0]?.title).toBe("News with Image");
            expect(newsList.items[1]?.title).toBe("Breaking News");

            // === GET SINGLE NEWS ===

            // 5. Anyone can get a single news article (public endpoint)
            const getResponse = await userClient.api.news[":id"].$get({
                param: { id: newsArticle.id },
            });

            expect(getResponse.status).toBe(200);
            const fetchedNews = await getResponse.json();
            expect(fetchedNews.id).toBe(newsArticle.id);
            expect(fetchedNews.title).toBe("Breaking News");
            expect(fetchedNews.creator).toBeDefined();
            expect(fetchedNews.creator?.id).toBe(creator.id);

            // 6. 404 for non-existent news
            const notFoundResponse = await userClient.api.news[":id"].$get({
                param: { id: "00000000-0000-0000-0000-000000000000" },
            });

            expect(notFoundResponse.status).toBe(404);

            // === UPDATE NEWS ===

            // 7. Creator can update their own news
            const creatorUpdateResponse = await creatorClient.api.news[
                ":id"
            ].$patch({
                param: { id: newsArticle.id },
                json: {
                    title: "Updated Breaking News",
                    body: "Updated content",
                },
            });

            expect(creatorUpdateResponse.status).toBe(200);
            const updatedByCreator = await creatorUpdateResponse.json();
            expect(updatedByCreator.title).toBe("Updated Breaking News");
            expect(updatedByCreator.body).toBe("Updated content");

            // 8. Editor with global permission can update any news
            const editorUpdateResponse = await editorClient.api.news[
                ":id"
            ].$patch({
                param: { id: newsArticle.id },
                json: {
                    header: "Updated by editor",
                },
            });

            expect(editorUpdateResponse.status).toBe(200);
            const updatedByEditor = await editorUpdateResponse.json();
            expect(updatedByEditor.header).toBe("Updated by editor");

            // 9. Regular user cannot update news they don't own
            const unauthorizedUpdateResponse = await userClient.api.news[
                ":id"
            ].$patch({
                param: { id: newsArticle.id },
                json: {
                    title: "Should fail",
                },
            });

            expect(unauthorizedUpdateResponse.status).toBe(403);

            // 10. Test scoped permission for update
            await ctx.db.insert(schema.userPermission).values({
                userId: regularUser.id,
                permission: "news:update",
                scope: `news-${newsWithImage.id}`,
            });

            const scopedUpdateResponse = await userClient.api.news[
                ":id"
            ].$patch({
                param: { id: newsWithImage.id },
                json: {
                    title: "Updated via scoped permission",
                },
            });

            expect(scopedUpdateResponse.status).toBe(200);

            // But scoped permission doesn't work for other news
            const scopedUpdateFailResponse = await userClient.api.news[
                ":id"
            ].$patch({
                param: { id: newsArticle.id },
                json: {
                    title: "Should still fail",
                },
            });

            expect(scopedUpdateFailResponse.status).toBe(403);

            // === REACTIONS ===

            // 11. Regular user can add reaction to news with reactions enabled
            const reactionResponse = await userClient.api.news[
                ":id"
            ].reactions.$post({
                param: { id: newsArticle.id },
                json: {
                    emoji: "👍",
                },
            });

            expect(reactionResponse.status).toBe(201);
            const reaction = await reactionResponse.json();
            expect(reaction.emoji).toBe("👍");
            expect(reaction.userId).toBe(regularUser.id);

            // 12. Update existing reaction
            const updateReactionResponse = await userClient.api.news[
                ":id"
            ].reactions.$post({
                param: { id: newsArticle.id },
                json: {
                    emoji: "❤️",
                },
            });

            expect(updateReactionResponse.status).toBe(200);
            const updatedReaction = await updateReactionResponse.json();
            expect(updatedReaction.emoji).toBe("❤️");

            // 13. Cannot add reaction to news with reactions disabled
            const reactionDisabledResponse = await userClient.api.news[
                ":id"
            ].reactions.$post({
                param: { id: newsWithImage.id },
                json: {
                    emoji: "😂",
                },
            });

            expect(reactionDisabledResponse.status).toBe(403);

            // 14. Verify reactions are included when getting news
            const newsWithReactionsResponse = await userClient.api.news[
                ":id"
            ].$get({
                param: { id: newsArticle.id },
            });

            const newsWithReactions = await newsWithReactionsResponse.json();
            expect(newsWithReactions.reactions).toBeDefined();
            expect(newsWithReactions.reactions.length).toBe(1);
            expect(newsWithReactions.reactions[0]?.emoji).toBe("❤️");

            // 15. Delete reaction
            const deleteReactionResponse = await userClient.api.news[
                ":id"
            ].reactions.$delete({
                param: { id: newsArticle.id },
            });

            expect(deleteReactionResponse.status).toBe(200);

            // 16. Cannot delete non-existent reaction
            const deleteAgainResponse = await userClient.api.news[
                ":id"
            ].reactions.$delete({
                param: { id: newsArticle.id },
            });

            expect(deleteAgainResponse.status).toBe(404);

            // === DELETE NEWS ===

            // 17. Regular user cannot delete news they don't own
            const unauthorizedDeleteResponse = await userClient.api.news[
                ":id"
            ].$delete({
                param: { id: newsWithImage.id },
            });

            expect(unauthorizedDeleteResponse.status).toBe(403);

            // 18. Creator can delete their own news
            const creatorDeleteResponse = await creatorClient.api.news[
                ":id"
            ].$delete({
                param: { id: newsArticle.id },
            });

            expect(creatorDeleteResponse.status).toBe(200);

            // Verify it's deleted
            const deletedCheckResponse = await userClient.api.news[":id"].$get({
                param: { id: newsArticle.id },
            });

            expect(deletedCheckResponse.status).toBe(404);

            // 19. Admin can delete any news
            const adminDeleteResponse = await adminClient.api.news[
                ":id"
            ].$delete({
                param: { id: newsWithImage.id },
            });

            expect(adminDeleteResponse.status).toBe(200);

            // 20. Test scoped delete permission
            const newsForScopedDelete = await editorClient.api.news.$post({
                json: {
                    title: "Test Scoped Delete",
                    header: "For testing",
                    body: "Will be deleted via scoped permission",
                    emojisAllowed: false,
                },
            });

            const scopedNewsData = await newsForScopedDelete.json();

            await ctx.db.insert(schema.userPermission).values({
                userId: regularUser.id,
                permission: "news:delete",
                scope: `news-${scopedNewsData.id}`,
            });

            const scopedDeleteResponse = await userClient.api.news[
                ":id"
            ].$delete({
                param: { id: scopedNewsData.id },
            });

            expect(scopedDeleteResponse.status).toBe(200);
        },
        120_000,
    );
});
