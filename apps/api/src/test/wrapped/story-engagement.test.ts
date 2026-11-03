import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import { eventWithPickedPhotos, markPublished } from "./helpers";

/** A published story with one picked photo, and a member to watch it. */
async function publishedPhoto(ctx: IntegrationTestContext) {
    const story = await eventWithPickedPhotos(ctx, 1);
    await markPublished(ctx, story.event.id);
    const [photo] = await ctx.db.query.wrappedPhoto.findMany();
    const member = await ctx.utils.createTestUser();
    return {
        ...story,
        member,
        param: { eventId: story.event.id, photoId: photo!.id },
    };
}

function photoApi(
    client: Awaited<
        ReturnType<IntegrationTestContext["utils"]["clientForUser"]>
    >,
) {
    return client.api.event[":eventId"].wrapped.story.photos[":photoId"];
}

describe("wrapped story likes and comments", () => {
    integrationTest(
        "liking is idempotent, and unliking takes it back",
        async ({ ctx }) => {
            const { member, param } = await publishedPhoto(ctx);
            const photo = photoApi(await ctx.utils.clientForUser(member));

            const first = await photo.like.$put({ param });
            expect(first.status).toBe(200);
            expect(await first.json()).toEqual({
                likeCount: 1,
                likedByMe: true,
            });
            expect(await (await photo.like.$put({ param })).json()).toEqual({
                likeCount: 1,
                likedByMe: true,
            });

            const removed = await photo.like.$delete({ param });
            expect(await removed.json()).toEqual({
                likeCount: 0,
                likedByMe: false,
            });
            expect((await photo.like.$delete({ param })).status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "a member comments, and the comment is listed with its author",
        async ({ ctx }) => {
            const { member, param } = await publishedPhoto(ctx);
            const photo = photoApi(await ctx.utils.clientForUser(member));

            const created = await photo.comments.$post({
                param,
                json: { body: "  Legendarisk kveld  " },
            });
            expect(created.status).toBe(201);
            expect(await created.json()).toMatchObject({
                body: "Legendarisk kveld",
                author: { id: member.id, name: member.name },
                canDelete: true,
            });

            const list = await (
                await photo.comments.$get({ param, query: {} })
            ).json();
            expect(list.totalCount).toBe(1);
            expect(list.items[0]?.body).toBe("Legendarisk kveld");
        },
        500_000,
    );

    integrationTest(
        "an empty or too long comment is rejected",
        async ({ ctx }) => {
            const { member, param } = await publishedPhoto(ctx);
            const photo = photoApi(await ctx.utils.clientForUser(member));

            for (const body of ["   ", "a".repeat(501)]) {
                const response = await photo.comments.$post({
                    param,
                    json: { body },
                });
                expect(response.status).toBe(400);
            }
            expect(
                await ctx.db.query.wrappedPhotoComment.findMany(),
            ).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "only the author or an organizer can delete a comment",
        async ({ ctx }) => {
            const { member, photographer, organizer, param } =
                await publishedPhoto(ctx);
            const asMember = photoApi(await ctx.utils.clientForUser(member));
            const comment = await (
                await asMember.comments.$post({ param, json: { body: "Hei" } })
            ).json();
            const commentParam = { ...param, commentId: comment.id };

            const asOther = photoApi(
                await ctx.utils.clientForUser(photographer),
            );
            const listed = await (
                await asOther.comments.$get({ param, query: {} })
            ).json();
            expect(listed.items[0]?.canDelete).toBe(false);
            expect(
                (
                    await asOther.comments[":commentId"].$delete({
                        param: commentParam,
                    })
                ).status,
            ).toBe(403);

            const asOrganizer = photoApi(
                await ctx.utils.clientForUser(organizer),
            );
            expect(
                (
                    await asOrganizer.comments[":commentId"].$delete({
                        param: commentParam,
                    })
                ).status,
            ).toBe(204);
            expect(
                await ctx.db.query.wrappedPhotoComment.findMany(),
            ).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "nothing works on an unpublished story",
        async ({ ctx }) => {
            const { event } = await eventWithPickedPhotos(ctx, 1);
            const [photo] = await ctx.db.query.wrappedPhoto.findMany();
            const param = { eventId: event.id, photoId: photo!.id };
            const member = await ctx.utils.createTestUser();
            const api = photoApi(await ctx.utils.clientForUser(member));

            expect((await api.like.$put({ param })).status).toBe(404);
            expect(
                (await api.comments.$post({ param, json: { body: "Hei" } }))
                    .status,
            ).toBe(404);
            expect((await api.comments.$get({ param, query: {} })).status).toBe(
                404,
            );
        },
        500_000,
    );
});
