import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("Feedback anonymity, comments and rejection", () => {
    integrationTest(
        "Author chooses whether their name is shown",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();
            const authorClient = await ctx.utils.clientForUser(author);
            const otherClient = await ctx.utils.clientForUser(other);

            const anonymous = await (
                await authorClient.api.feedback.$post({
                    json: {
                        type: "bug",
                        title: "Anonym feil",
                        description: "Ingen skal vite hvem som sendte dette.",
                    },
                })
            ).json();
            expect(anonymous.isAnonymous).toBe(true);
            expect(anonymous.author).toBeNull();

            const named = await (
                await authorClient.api.feedback.$post({
                    json: {
                        type: "idea",
                        title: "Navngitt idé",
                        description: "Index kan spørre meg om detaljer.",
                        isAnonymous: false,
                    },
                })
            ).json();
            expect(named.isAnonymous).toBe(false);
            expect(named.author?.id).toBe(author.id);

            const list = await (
                await otherClient.api.feedback.$get({ query: {} })
            ).json();
            const byId = new Map(list.items.map((item) => [item.id, item]));
            expect(byId.get(anonymous.id)?.author).toBeNull();
            expect(byId.get(named.id)?.author?.id).toBe(author.id);
            expect(byId.get(named.id)?.author?.name).toBe(author.name);

            const single = await otherClient.api.feedback[":id"].$get({
                param: { id: anonymous.id },
            });
            expect(single.status).toBe(200);
            expect((await single.json()).author).toBeNull();

            // Index handles the reports, so anonymity does not hide the
            // author from them.
            const moderator = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(moderator, ["feedback:update"]);
            const moderatorClient = await ctx.utils.clientForUser(moderator);

            const moderatorList = await (
                await moderatorClient.api.feedback.$get({ query: {} })
            ).json();
            const moderatorView = moderatorList.items.find(
                (item) => item.id === anonymous.id,
            );
            expect(moderatorView?.isAnonymous).toBe(true);
            expect(moderatorView?.author?.id).toBe(author.id);

            const moderatorSingle = await (
                await moderatorClient.api.feedback[":id"].$get({
                    param: { id: anonymous.id },
                })
            ).json();
            expect(moderatorSingle.author?.name).toBe(author.name);

            const moderatorUpdate = await (
                await moderatorClient.api.feedback[":id"].$patch({
                    param: { id: anonymous.id },
                    json: { status: "in_progress" },
                })
            ).json();
            expect(moderatorUpdate.author?.id).toBe(author.id);
        },
        500_000,
    );

    integrationTest(
        "Index comments, author is notified and replies anonymously",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            const indexMember = await ctx.utils.createTestUser();
            const bystander = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(indexMember, [
                "feedback:update",
            ]);

            const authorClient = await ctx.utils.clientForUser(author);
            const indexClient = await ctx.utils.clientForUser(indexMember);
            const bystanderClient = await ctx.utils.clientForUser(bystander);

            const feedback = await (
                await authorClient.api.feedback.$post({
                    json: {
                        type: "bug",
                        title: "Kalenderen henger",
                        description: "Den laster aldri på mobil.",
                    },
                })
            ).json();

            const denied = await bystanderClient.api.feedback[
                ":id"
            ].comments.$post({
                param: { id: feedback.id },
                json: { body: "Jeg også!" },
            });
            expect(denied.status).toBe(403);

            const indexReply = await indexClient.api.feedback[
                ":id"
            ].comments.$post({
                param: { id: feedback.id },
                json: { body: "Hvilken telefon bruker du?" },
            });
            expect(indexReply.status).toBe(201);
            const indexComment = await indexReply.json();
            expect(indexComment.isFeedbackAuthor).toBe(false);
            expect(indexComment.author?.id).toBe(indexMember.id);

            const authorNotifications = await ctx.db
                .select()
                .from(schema.notification)
                .where(eq(schema.notification.userId, author.id));
            expect(authorNotifications).toHaveLength(1);
            expect(authorNotifications[0]?.title).toBe(
                "Index har svart på tilbakemeldingen din",
            );
            expect(authorNotifications[0]?.description).toContain(
                "Hvilken telefon bruker du?",
            );
            expect(authorNotifications[0]?.link).toBe(
                `/tilbakemelding?id=${feedback.id}`,
            );

            const authorReply = await authorClient.api.feedback[
                ":id"
            ].comments.$post({
                param: { id: feedback.id },
                json: { body: "En iPhone 15." },
            });
            expect(authorReply.status).toBe(201);
            const authorComment = await authorReply.json();
            expect(authorComment.isFeedbackAuthor).toBe(true);
            expect(authorComment.author).toBeNull();

            const indexNotifications = await ctx.db
                .select()
                .from(schema.notification)
                .where(eq(schema.notification.userId, indexMember.id));
            expect(indexNotifications).toHaveLength(1);
            expect(indexNotifications[0]?.title).toBe(
                "Nytt svar på «Kalenderen henger»",
            );

            const thread = await (
                await bystanderClient.api.feedback[":id"].comments.$get({
                    param: { id: feedback.id },
                })
            ).json();
            expect(thread.map((comment) => comment.body)).toEqual([
                "Hvilken telefon bruker du?",
                "En iPhone 15.",
            ]);
            expect(thread[1]?.author).toBeNull();
            expect(thread.every((comment) => !comment.isMine)).toBe(true);

            const list = await (
                await bystanderClient.api.feedback.$get({ query: {} })
            ).json();
            expect(list.items[0]?.commentCount).toBe(2);

            const deniedDelete = await authorClient.api.feedback[
                ":id"
            ].comments[":commentId"].$delete({
                param: { id: feedback.id, commentId: indexComment.id },
            });
            expect(deniedDelete.status).toBe(403);

            const deleted = await indexClient.api.feedback[":id"].comments[
                ":commentId"
            ].$delete({
                param: { id: feedback.id, commentId: indexComment.id },
            });
            expect(deleted.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "A moderator replying on their own anonymous feedback stays anonymous",
        async ({ ctx }) => {
            const moderator = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(moderator, ["feedback:manage"]);
            const client = await ctx.utils.clientForUser(moderator);

            const feedback = await (
                await client.api.feedback.$post({
                    json: {
                        type: "idea",
                        title: "Mørk modus",
                        description: "Det hadde vært fint om kvelden.",
                    },
                })
            ).json();

            const reply = await (
                await client.api.feedback[":id"].comments.$post({
                    param: { id: feedback.id },
                    json: { body: "Tillegg: også i appen." },
                })
            ).json();

            expect(reply.isFeedbackAuthor).toBe(true);
            expect(reply.author).toBeNull();
            expect(
                await ctx.db.select().from(schema.notification),
            ).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "Index rejects with a reason, and the author is told why",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            const indexMember = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(indexMember, [
                "feedback:update",
            ]);
            const authorClient = await ctx.utils.clientForUser(author);
            const indexClient = await ctx.utils.clientForUser(indexMember);

            const feedback = await (
                await authorClient.api.feedback.$post({
                    json: {
                        type: "idea",
                        title: "Gratis pizza",
                        description: "På alle arrangementer, hele tiden.",
                    },
                })
            ).json();

            // The author may edit their text, but not reject on Index's behalf.
            const authorAttempt = await authorClient.api.feedback[":id"].$patch(
                {
                    param: { id: feedback.id },
                    json: { status: "rejected", rejectionReason: "Nei" },
                },
            );
            expect(authorAttempt.status).toBe(403);

            const reasonWithoutRejecting = await indexClient.api.feedback[
                ":id"
            ].$patch({
                param: { id: feedback.id },
                json: { rejectionReason: "For dyrt" },
            });
            expect(reasonWithoutRejecting.status).toBe(400);

            const rejected = await indexClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: {
                    status: "rejected",
                    rejectionReason: "  Budsjettet tillater det ikke.  ",
                },
            });
            expect(rejected.status).toBe(200);
            const rejectedItem = await rejected.json();
            expect(rejectedItem.status).toBe("rejected");
            expect(rejectedItem.rejectionReason).toBe(
                "Budsjettet tillater det ikke.",
            );

            const notifications = await ctx.db
                .select()
                .from(schema.notification)
                .where(eq(schema.notification.userId, author.id));
            expect(notifications).toHaveLength(1);
            expect(notifications[0]?.title).toBe(
                "Tilbakemeldingen din ble avvist",
            );
            expect(notifications[0]?.description).toBe(
                "«Gratis pizza»: Budsjettet tillater det ikke.",
            );

            const edited = await indexClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { rejectionReason: "For dyrt." },
            });
            expect((await edited.json()).rejectionReason).toBe("For dyrt.");
            expect(
                await ctx.db
                    .select()
                    .from(schema.notification)
                    .where(eq(schema.notification.userId, author.id)),
            ).toHaveLength(1);

            const reopened = await indexClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { status: "open" },
            });
            expect((await reopened.json()).rejectionReason).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "Author edits and toggles anonymity until anyone else reacts",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            const voter = await ctx.utils.createTestUser();
            const indexMember = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(indexMember, [
                "feedback:update",
            ]);
            const authorClient = await ctx.utils.clientForUser(author);
            const voterClient = await ctx.utils.clientForUser(voter);
            const indexClient = await ctx.utils.clientForUser(indexMember);

            const create = async (title: string) =>
                (
                    await authorClient.api.feedback.$post({
                        json: {
                            type: "bug",
                            title,
                            description: "Noe virker ikke som det skal.",
                        },
                    })
                ).json();

            const feedback = await create("Første utkast");
            expect(feedback.isEditable).toBe(true);

            const asIndex = await (
                await indexClient.api.feedback[":id"].$get({
                    param: { id: feedback.id },
                })
            ).json();
            expect(asIndex.isEditable).toBe(false);

            const indexEdit = await indexClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { title: "Index sin tittel" },
            });
            expect(indexEdit.status).toBe(403);
            const indexDescription = await indexClient.api.feedback[
                ":id"
            ].$patch({
                param: { id: feedback.id },
                json: { description: "Index skrev om beskrivelsen." },
            });
            expect(indexDescription.status).toBe(403);

            const indexReveal = await indexClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { isAnonymous: false },
            });
            expect(indexReveal.status).toBe(403);

            // The author's own vote is not someone else's reaction.
            await authorClient.api.feedback[":id"].vote.$put({
                param: { id: feedback.id },
                json: { value: "up" },
            });

            const edited = await authorClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { title: "Bedre tittel", isAnonymous: false },
            });
            expect(edited.status).toBe(200);
            const editedItem = await edited.json();
            expect(editedItem.title).toBe("Bedre tittel");
            expect(editedItem.isAnonymous).toBe(false);
            expect(editedItem.author?.id).toBe(author.id);

            const backToAnonymous = await authorClient.api.feedback[
                ":id"
            ].$patch({
                param: { id: feedback.id },
                json: { isAnonymous: true },
            });
            expect((await backToAnonymous.json()).author).toBeNull();

            await voterClient.api.feedback[":id"].vote.$put({
                param: { id: feedback.id },
                json: { value: "up" },
            });
            const afterVote = await authorClient.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { title: "Enda en tittel" },
            });
            expect(afterVote.status).toBe(409);
            const lockedAnonymity = await authorClient.api.feedback[
                ":id"
            ].$patch({
                param: { id: feedback.id },
                json: { isAnonymous: false },
            });
            expect(lockedAnonymity.status).toBe(409);

            const commented = await create("Kommentert");
            await indexClient.api.feedback[":id"].comments.$post({
                param: { id: commented.id },
                json: { body: "Hvilken nettleser?" },
            });
            const afterComment = await authorClient.api.feedback[":id"].$patch({
                param: { id: commented.id },
                json: { description: "Ny beskrivelse av problemet." },
            });
            expect(afterComment.status).toBe(409);

            const inProgress = await create("Under arbeid");
            await indexClient.api.feedback[":id"].$patch({
                param: { id: inProgress.id },
                json: { status: "in_progress" },
            });
            const afterStatus = await (
                await authorClient.api.feedback[":id"].$get({
                    param: { id: inProgress.id },
                })
            ).json();
            expect(afterStatus.isEditable).toBe(false);
            const editInProgress = await authorClient.api.feedback[
                ":id"
            ].$patch({
                param: { id: inProgress.id },
                json: { title: "Ny tittel" },
            });
            expect(editInProgress.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "An Index member who filed it is locked like any other author",
        async ({ ctx }) => {
            const moderator = await ctx.utils.createTestUser();
            const voter = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(moderator, ["feedback:manage"]);
            const client = await ctx.utils.clientForUser(moderator);
            const voterClient = await ctx.utils.clientForUser(voter);

            const feedback = await (
                await client.api.feedback.$post({
                    json: {
                        type: "idea",
                        title: "Egen idé",
                        description: "En idé fra noen i Index.",
                    },
                })
            ).json();

            await voterClient.api.feedback[":id"].vote.$put({
                param: { id: feedback.id },
                json: { value: "down" },
            });

            const edit = await client.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { title: "Omskrevet etter stemmen" },
            });
            expect(edit.status).toBe(409);

            const rejected = await client.api.feedback[":id"].$patch({
                param: { id: feedback.id },
                json: { status: "rejected", rejectionReason: "Duplikat." },
            });
            expect(rejected.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "Author can delete only while it is still editable",
        async ({ ctx }) => {
            const author = await ctx.utils.createTestUser();
            const voter = await ctx.utils.createTestUser();
            const deleter = await ctx.utils.createTestUser();
            const indexAuthor = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(deleter, ["feedback:delete"]);
            await ctx.utils.giveUserPermissions(indexAuthor, [
                "feedback:manage",
            ]);
            const authorClient = await ctx.utils.clientForUser(author);
            const voterClient = await ctx.utils.clientForUser(voter);
            const deleterClient = await ctx.utils.clientForUser(deleter);
            const indexAuthorClient =
                await ctx.utils.clientForUser(indexAuthor);

            const create = async (client: typeof authorClient, title: string) =>
                (
                    await client.api.feedback.$post({
                        json: {
                            type: "idea",
                            title,
                            description: "En idé som skal slettes.",
                        },
                    })
                ).json();

            const untouched = await create(authorClient, "Urørt");
            const ownDelete = await authorClient.api.feedback[":id"].$delete({
                param: { id: untouched.id },
            });
            expect(ownDelete.status).toBe(200);

            const voted = await create(authorClient, "Har fått stemme");
            await voterClient.api.feedback[":id"].vote.$put({
                param: { id: voted.id },
                json: { value: "up" },
            });
            const lockedDelete = await authorClient.api.feedback[":id"].$delete(
                { param: { id: voted.id } },
            );
            expect(lockedDelete.status).toBe(409);

            const indexDelete = await deleterClient.api.feedback[":id"].$delete(
                { param: { id: voted.id } },
            );
            expect(indexDelete.status).toBe(200);

            // Holding the permission lifts the lock on your own, too.
            const indexOwn = await create(indexAuthorClient, "Fra Index");
            await voterClient.api.feedback[":id"].vote.$put({
                param: { id: indexOwn.id },
                json: { value: "down" },
            });
            const indexOwnDelete = await indexAuthorClient.api.feedback[
                ":id"
            ].$delete({ param: { id: indexOwn.id } });
            expect(indexOwnDelete.status).toBe(200);
        },
        500_000,
    );
});
