import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { discardExpiredDrafts } from "~/lib/wrapped/drafts";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import {
    createOngoingEvent,
    enableCamera,
    register,
    sessionCookie,
    submitPhotos,
    uploadPhoto,
} from "./helpers";

const HOUR = 60 * 60 * 1000;

type MyPhoto = { id: string; source: string; submitted: boolean };

/** A camera that is open, a member with a spot, and an organizer. */
async function openCamera(ctx: IntegrationTestContext, shotsPerPerson = 5) {
    const event = await createOngoingEvent(ctx);
    await enableCamera(ctx, event.id, shotsPerPerson);

    const member = await ctx.utils.createTestUser();
    await register(ctx, event.id, member.id);
    const cookie = await sessionCookie(ctx, member);

    const organizer = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(organizer, ["events:update"]);

    return { event, member, cookie, organizer };
}

async function upload(
    ctx: IntegrationTestContext,
    cookie: string,
    eventId: string,
): Promise<string> {
    const response = await uploadPhoto(ctx, cookie, eventId);
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
}

function request(
    ctx: IntegrationTestContext,
    cookie: string,
    path: string,
    method = "GET",
) {
    return ctx.app.request(`/api/event/${path}`, {
        method,
        headers: { Cookie: cookie },
    });
}

async function myPhotos(
    ctx: IntegrationTestContext,
    cookie: string,
    eventId: string,
): Promise<MyPhoto[]> {
    const response = await request(
        ctx,
        cookie,
        `${eventId}/wrapped/photos/mine`,
    );
    expect(response.status).toBe(200);
    return (await response.json()) as MyPhoto[];
}

async function organizerPhotoIds(
    ctx: IntegrationTestContext,
    organizer: Awaited<
        ReturnType<IntegrationTestContext["utils"]["createTestUser"]>
    >,
    eventId: string,
) {
    const client = await ctx.utils.clientForUser(organizer);
    const response = await client.api.event[":eventId"].wrapped.photos.$get({
        param: { eventId },
        query: {},
    });
    const body = await response.json();
    return { ids: body.items.map((p) => p.id), body };
}

/** Move the event back so its camera closed an hour ago. */
async function closeCamera(ctx: IntegrationTestContext, eventId: string) {
    const now = Date.now();
    await ctx.db
        .update(schema.event)
        .set({ start: new Date(now - 8 * HOUR), end: new Date(now - 5 * HOUR) })
        .where(eq(schema.event.id, eventId));
}

function photoRow(ctx: IntegrationTestContext, id: string) {
    return ctx.db.query.wrappedPhoto.findFirst({
        where: eq(schema.wrappedPhoto.id, id),
    });
}

describe("wrapped drafts", () => {
    integrationTest(
        "a new photo is a draft only its owner sees",
        async ({ ctx }) => {
            const { event, cookie, organizer } = await openCamera(ctx);
            const id = await upload(ctx, cookie, event.id);

            expect(await myPhotos(ctx, cookie, event.id)).toEqual([
                expect.objectContaining({
                    id,
                    submitted: false,
                    source: "camera",
                }),
            ]);

            const { ids, body } = await organizerPhotoIds(
                ctx,
                organizer,
                event.id,
            );
            expect(ids).toEqual([]);
            expect(body.totalCount).toBe(0);

            const client = await ctx.utils.clientForUser(organizer);
            const param = { eventId: event.id, photoId: id };
            const photos = client.api.event[":eventId"].wrapped.photos;
            expect(
                (await photos[":photoId"].image.$get({ param, query: {} }))
                    .status,
            ).toBe(404);
            expect(
                (
                    await photos[":photoId"].$patch({
                        param,
                        json: { selected: true },
                    })
                ).status,
            ).toBe(404);

            const status = await request(ctx, cookie, `${event.id}/wrapped`);
            expect(await status.json()).toMatchObject({
                shotsUsed: 1,
                draftCount: 1,
            });
        },
        500_000,
    );

    integrationTest(
        "the owner can see the image of their own photo, nobody else through that route",
        async ({ ctx }) => {
            const { event, cookie } = await openCamera(ctx);
            const id = await upload(ctx, cookie, event.id);

            const mine = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/${id}/image`,
            );
            expect(mine.status).toBe(200);
            expect(mine.headers.get("X-Content-Type-Options")).toBe("nosniff");
            expect(mine.headers.get("Cache-Control")).toBe("private, no-store");

            const other = await ctx.utils.createTestUser();
            await register(ctx, event.id, other.id);
            const theirs = await request(
                ctx,
                await sessionCookie(ctx, other),
                `${event.id}/wrapped/photos/mine/${id}/image`,
            );
            expect(theirs.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "submitting picked drafts, then the rest, then again changes nothing",
        async ({ ctx }) => {
            const { event, cookie, organizer } = await openCamera(ctx);
            const first = await upload(ctx, cookie, event.id);
            const second = await upload(ctx, cookie, event.id);
            const third = await upload(ctx, cookie, event.id);

            const some = await submitPhotos(ctx, cookie, event.id, [first]);
            expect(some.status).toBe(200);
            expect(await some.json()).toEqual({
                submittedCount: 1,
                draftCount: 2,
            });
            expect(
                (await organizerPhotoIds(ctx, organizer, event.id)).ids,
            ).toEqual([first]);

            const rest = await submitPhotos(ctx, cookie, event.id);
            expect(await rest.json()).toEqual({
                submittedCount: 2,
                draftCount: 0,
            });

            const again = await submitPhotos(ctx, cookie, event.id);
            expect(again.status).toBe(200);
            expect(await again.json()).toEqual({
                submittedCount: 0,
                draftCount: 0,
            });

            const { ids, body } = await organizerPhotoIds(
                ctx,
                organizer,
                event.id,
            );
            expect(ids.sort()).toEqual([first, second, third].sort());
            expect(body.totalCount).toBe(3);
        },
        500_000,
    );

    integrationTest(
        "nothing can be submitted once the camera has closed",
        async ({ ctx }) => {
            const { event, cookie } = await openCamera(ctx);
            await upload(ctx, cookie, event.id);
            await closeCamera(ctx, event.id);

            const response = await submitPhotos(ctx, cookie, event.id);
            expect(response.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "deleting a draft gives the shot back and removes the file",
        async ({ ctx }) => {
            const { event, member, cookie } = await openCamera(ctx, 2);
            const id = await upload(ctx, cookie, event.id);
            const row = await photoRow(ctx, id);

            const response = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/${id}`,
                "DELETE",
            );

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({
                shotsUsed: 0,
                shotsLeft: 2,
            });
            expect(await photoRow(ctx, id)).toBeUndefined();
            expect(await ctx.bucket.getAsset(row!.assetKey)).toBeNull();
            expect(
                await ctx.db.query.asset.findMany({
                    where: eq(schema.asset.uploadedById, member.id),
                }),
            ).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "a photo that is someone else's, submitted, or past closing cannot be deleted",
        async ({ ctx }) => {
            const { event, cookie } = await openCamera(ctx);
            const submitted = await upload(ctx, cookie, event.id);
            await submitPhotos(ctx, cookie, event.id);
            const draft = await upload(ctx, cookie, event.id);

            const other = await ctx.utils.createTestUser();
            await register(ctx, event.id, other.id);
            const theirs = await request(
                ctx,
                await sessionCookie(ctx, other),
                `${event.id}/wrapped/photos/mine/${draft}`,
                "DELETE",
            );
            expect(theirs.status).toBe(404);

            const done = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/${submitted}`,
                "DELETE",
            );
            expect(done.status).toBe(409);

            await closeCamera(ctx, event.id);
            const late = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/${draft}`,
                "DELETE",
            );
            expect(late.status).toBe(409);

            expect(await photoRow(ctx, draft)).toBeDefined();
            expect(await photoRow(ctx, submitted)).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "drafts left at closing are hidden from everyone and then discarded",
        async ({ ctx }) => {
            const { event, cookie, organizer } = await openCamera(ctx);
            const submitted = await upload(ctx, cookie, event.id);
            await submitPhotos(ctx, cookie, event.id);
            const draft = await upload(ctx, cookie, event.id);
            const draftRow = await photoRow(ctx, draft);

            await closeCamera(ctx, event.id);

            // Hidden before the cleanup has run.
            expect(
                (await myPhotos(ctx, cookie, event.id)).map((p) => p.id),
            ).toEqual([submitted]);
            expect(
                (
                    await request(
                        ctx,
                        cookie,
                        `${event.id}/wrapped/photos/mine/${draft}/image`,
                    )
                ).status,
            ).toBe(404);
            expect(
                (await organizerPhotoIds(ctx, organizer, event.id)).ids,
            ).toEqual([submitted]);
            const status = await request(ctx, cookie, `${event.id}/wrapped`);
            expect(await status.json()).toMatchObject({ draftCount: 0 });

            expect(await discardExpiredDrafts(ctx)).toBe(1);

            expect(await photoRow(ctx, draft)).toBeUndefined();
            expect(await ctx.bucket.getAsset(draftRow!.assetKey)).toBeNull();
            expect(await photoRow(ctx, submitted)).toBeDefined();
            // Nothing left to do on the next run.
            expect(await discardExpiredDrafts(ctx)).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "a draft at a camera that is still open is never discarded",
        async ({ ctx }) => {
            const { event, cookie } = await openCamera(ctx);
            const draft = await upload(ctx, cookie, event.id);

            expect(await discardExpiredDrafts(ctx)).toBe(0);
            expect(await photoRow(ctx, draft)).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "a camera-roll photo is labelled as one and costs a shot like any other",
        async ({ ctx }) => {
            const { event, cookie, organizer } = await openCamera(ctx, 1);
            const body = new FormData();
            body.append(
                "file",
                new Blob(
                    [
                        new Uint8Array(
                            Buffer.concat([
                                Buffer.from([
                                    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a,
                                    0x0a,
                                ]),
                                Buffer.from("rull"),
                            ]),
                        ),
                    ],
                    { type: "image/png" },
                ),
                "rull.png",
            );
            const response = await ctx.app.request(
                `/api/event/${event.id}/wrapped/photos?source=camera_roll`,
                { method: "POST", body, headers: { Cookie: cookie } },
            );
            expect(response.status).toBe(201);

            expect(await myPhotos(ctx, cookie, event.id)).toEqual([
                expect.objectContaining({ source: "camera_roll" }),
            ]);
            // The one shot is spent.
            expect((await uploadPhoto(ctx, cookie, event.id)).status).toBe(409);

            await submitPhotos(ctx, cookie, event.id);
            const { body: list } = await organizerPhotoIds(
                ctx,
                organizer,
                event.id,
            );
            expect(list.items[0]).toMatchObject({ source: "camera_roll" });
        },
        500_000,
    );
});
