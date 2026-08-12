import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Feedback", () => {
    integrationTest(
        "Complete lifecycle: create, list, filter, edit, moderate, delete",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();
            const moderator = await ctx.utils.createTestUser();

            await ctx.utils.giveUserPermissions(moderator, ["feedback:manage"]);

            const authorClient = await ctx.utils.clientForUser(author);
            const otherClient = await ctx.utils.clientForUser(other);
            const moderatorClient = await ctx.utils.clientForUser(moderator);

            // === CREATE ===

            // Any member may file feedback — no permission involved.
            const ideaResponse = await authorClient.api.feedback.$post({
                json: {
                    type: "idea",
                    title: "Telefonnummer på profiler",
                    description:
                        "Arrangører bør kunne ringe folk som kommer sent.",
                },
            });

            expect(ideaResponse.status).toBe(201);
            const idea = await ideaResponse.json();
            expect(idea.type).toBe("idea");
            expect(idea.status).toBe("open");
            expect(idea.author?.id).toBe(author.id);
            expect(idea.upvotes).toBe(0);
            expect(idea.myVote).toBeNull();

            const bugResponse = await otherClient.api.feedback.$post({
                json: {
                    type: "bug",
                    title: "Filteret virker ikke",
                    description: "Alle kategorier gir «noe gikk galt».",
                },
            });
            expect(bugResponse.status).toBe(201);
            const bug = await bugResponse.json();

            // A title of one character is below the minimum.
            const tooShortResponse = await authorClient.api.feedback.$post({
                json: { type: "idea", title: "x", description: "Kort tittel." },
            });
            expect(tooShortResponse.status).toBe(400);

            // === LIST AND FILTER ===

            const listResponse = await otherClient.api.feedback.$get({
                query: {},
            });
            expect(listResponse.status).toBe(200);
            const list = await listResponse.json();
            expect(list.totalCount).toBe(2);
            // Newest first.
            expect(list.items[0]?.id).toBe(bug.id);

            const bugsOnly = await otherClient.api.feedback.$get({
                query: { type: "bug" },
            });
            const bugs = await bugsOnly.json();
            expect(bugs.totalCount).toBe(1);
            expect(bugs.items[0]?.id).toBe(bug.id);

            const searchResponse = await otherClient.api.feedback.$get({
                query: { search: "telefonnummer" },
            });
            const found = await searchResponse.json();
            expect(found.totalCount).toBe(1);
            expect(found.items[0]?.id).toBe(idea.id);

            // === VOTES ===

            const upvote = await otherClient.api.feedback[":id"].vote.$put({
                param: { id: idea.id },
                json: { value: "up" },
            });
            expect(upvote.status).toBe(200);
            expect(await upvote.json()).toMatchObject({
                upvotes: 1,
                downvotes: 0,
                myVote: "up",
            });

            // Voting the other way replaces the vote rather than adding one.
            const switched = await otherClient.api.feedback[":id"].vote.$put({
                param: { id: idea.id },
                json: { value: "down" },
            });
            expect(await switched.json()).toMatchObject({
                upvotes: 0,
                downvotes: 1,
                myVote: "down",
            });

            const withdrawn = await otherClient.api.feedback[
                ":id"
            ].vote.$delete({
                param: { id: idea.id },
            });
            expect(await withdrawn.json()).toMatchObject({
                upvotes: 0,
                downvotes: 0,
                myVote: null,
            });

            // The tally and the caller's own vote come back on the list too.
            await authorClient.api.feedback[":id"].vote.$put({
                param: { id: idea.id },
                json: { value: "up" },
            });
            const afterVote = await (
                await otherClient.api.feedback.$get({
                    query: { search: "telefonnummer" },
                })
            ).json();
            expect(afterVote.items[0]?.upvotes).toBe(1);
            // `other` withdrew their vote, so this stays null for them.
            expect(afterVote.items[0]?.myVote).toBeNull();

            // === UPDATE ===

            // The author may edit their own text.
            const edited = await authorClient.api.feedback[":id"].$patch({
                param: { id: idea.id },
                json: { description: "Oppdatert beskrivelse." },
            });
            expect(edited.status).toBe(200);
            expect((await edited.json()).description).toBe(
                "Oppdatert beskrivelse.",
            );

            // Someone else's feedback is off limits without a permission.
            const foreignEdit = await otherClient.api.feedback[":id"].$patch({
                param: { id: idea.id },
                json: { title: "Kapret" },
            });
            expect(foreignEdit.status).toBe(403);

            // Status is moderation: the author cannot set it on their own.
            const selfClose = await authorClient.api.feedback[":id"].$patch({
                param: { id: idea.id },
                json: { status: "closed" },
            });
            expect(selfClose.status).toBe(403);

            const moderated = await moderatorClient.api.feedback[":id"].$patch({
                param: { id: idea.id },
                json: { status: "in_progress" },
            });
            expect(moderated.status).toBe(200);
            expect((await moderated.json()).status).toBe("in_progress");

            const inProgress = await (
                await moderatorClient.api.feedback.$get({
                    query: { status: "in_progress" },
                })
            ).json();
            expect(inProgress.totalCount).toBe(1);

            // === DELETE ===

            // Not yours, and no permission.
            const foreignDelete = await otherClient.api.feedback[":id"].$delete(
                {
                    param: { id: idea.id },
                },
            );
            expect(foreignDelete.status).toBe(403);

            // The author may remove their own.
            const ownDelete = await authorClient.api.feedback[":id"].$delete({
                param: { id: idea.id },
            });
            expect(ownDelete.status).toBe(200);

            // A moderator may remove anyone's.
            const moderatorDelete = await moderatorClient.api.feedback[
                ":id"
            ].$delete({
                param: { id: bug.id },
            });
            expect(moderatorDelete.status).toBe(200);

            const empty = await (
                await moderatorClient.api.feedback.$get({ query: {} })
            ).json();
            expect(empty.totalCount).toBe(0);
        },
    );

    integrationTest(
        "Requires authentication and rejects unknown ids",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const anonymous = await ctx.utils
                .client()
                .api.feedback.$get({ query: {} });
            expect(anonymous.status).toBe(401);

            // 403 rather than 404: access is decided before the row is
            // looked up, and a caller who owns nothing and holds nothing is
            // refused whether or not the id exists. The 404 branch is what a
            // moderator gets — same as the other author-owned resources.
            const missing = await client.api.feedback[":id"].$delete({
                param: { id: "00000000-0000-4000-8000-000000000000" },
            });
            expect(missing.status).toBe(403);

            const malformed = await client.api.feedback[":id"].vote.$put({
                param: { id: "not-a-uuid" },
                json: { value: "up" },
            });
            expect(malformed.status).toBe(400);
        },
    );
});
