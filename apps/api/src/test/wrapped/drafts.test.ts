import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { AUTO_SUBMIT_AFTER_CLOSE_MS, cameraWindow } from "~/lib/wrapped";
import { deleteDraft, submitClosedDrafts } from "~/lib/wrapped/drafts";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import {
    closeAndSubmit,
    closeCamera,
    createOngoingEvent,
    enableCamera,
    register,
    sessionCookie,
    uploadPhoto,
} from "./helpers";

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

function photoRow(ctx: IntegrationTestContext, id: string) {
    return ctx.db.query.wrappedPhoto.findFirst({
        where: { id },
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
        "the submit route is gone",
        async ({ ctx }) => {
            const { event, cookie } = await openCamera(ctx);
            await upload(ctx, cookie, event.id);

            const response = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/submit`,
                "POST",
            );
            expect(response.status).toBe(404);
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
                    where: { uploadedById: member.id },
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

            // Closed longer ago than the grace minute, sweep not yet run.
            await closeCamera(ctx, event.id);
            const late = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/${draft}`,
                "DELETE",
            );
            expect(late.status).toBe(409);

            // Once the sweep has run, the photo is submitted: still 409.
            await submitClosedDrafts(ctx.db);
            const done = await request(
                ctx,
                cookie,
                `${event.id}/wrapped/photos/mine/${submitted}`,
                "DELETE",
            );
            expect(done.status).toBe(409);

            expect(await photoRow(ctx, draft)).toBeDefined();
            expect(await photoRow(ctx, submitted)).toBeDefined();
        },
        500_000,
    );

    integrationTest(
        "drafts left at closing are submitted automatically, file and all",
        async ({ ctx }) => {
            const { event, cookie, organizer } = await openCamera(ctx);
            const first = await upload(ctx, cookie, event.id);
            const second = await upload(ctx, cookie, event.id);
            const rows = await Promise.all([
                photoRow(ctx, first),
                photoRow(ctx, second),
            ]);

            await closeCamera(ctx, event.id);

            // Still the member's own until the sweep has run.
            expect(await myPhotos(ctx, cookie, event.id)).toEqual([
                expect.objectContaining({ id: first, submitted: false }),
                expect.objectContaining({ id: second, submitted: false }),
            ]);
            expect(
                (await organizerPhotoIds(ctx, organizer, event.id)).ids,
            ).toEqual([]);
            expect(
                await (
                    await request(ctx, cookie, `${event.id}/wrapped`)
                ).json(),
            ).toMatchObject({ draftCount: 2 });

            expect(await submitClosedDrafts(ctx.db)).toEqual({
                submitted: 2,
                eventIds: [event.id],
            });

            expect(
                (await organizerPhotoIds(ctx, organizer, event.id)).ids.sort(),
            ).toEqual([first, second].sort());
            expect(await myPhotos(ctx, cookie, event.id)).toEqual([
                expect.objectContaining({ id: first, submitted: true }),
                expect.objectContaining({ id: second, submitted: true }),
            ]);
            expect(
                (
                    await request(
                        ctx,
                        cookie,
                        `${event.id}/wrapped/photos/mine/${first}/image`,
                    )
                ).status,
            ).toBe(200);
            for (const row of rows) {
                expect(await ctx.bucket.getAsset(row!.assetKey)).not.toBeNull();
            }
            const status = await request(ctx, cookie, `${event.id}/wrapped`);
            expect(await status.json()).toMatchObject({ draftCount: 0 });

            // Nothing left to do on the next run.
            expect(await submitClosedDrafts(ctx.db)).toEqual({
                submitted: 0,
                eventIds: [],
            });
        },
        500_000,
    );

    integrationTest(
        "a draft at an open camera, or one closed less than a minute ago, is left alone",
        async ({ ctx }) => {
            const { event, cookie } = await openCamera(ctx);
            await upload(ctx, cookie, event.id);

            expect((await submitClosedDrafts(ctx.db)).submitted).toBe(0);

            const eventRow = await ctx.db.query.event.findFirst({
                where: { id: event.id },
            });
            const { closesAt } = cameraWindow(eventRow!);
            const closedFor = (ms: number) =>
                new Date(closesAt.getTime() + AUTO_SUBMIT_AFTER_CLOSE_MS + ms);

            expect(
                (await submitClosedDrafts(ctx.db, closedFor(-1000))).submitted,
            ).toBe(0);
            expect(
                (await submitClosedDrafts(ctx.db, closedFor(1000))).submitted,
            ).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "a draft can be deleted until a minute after closing, never after",
        async ({ ctx }) => {
            const { event, member, cookie } = await openCamera(ctx);
            const first = await upload(ctx, cookie, event.id);
            const second = await upload(ctx, cookie, event.id);
            const eventRow = await ctx.db.query.event.findFirst({
                where: { id: event.id },
            });
            const closesAt = cameraWindow(eventRow!).closesAt.getTime();
            const owner = { eventId: event.id, userId: member.id };

            expect(
                await deleteDraft(
                    ctx.db,
                    { ...owner, photoId: first },
                    new Date(closesAt + 30_000),
                ),
            ).toMatchObject({ assetKey: expect.any(String) });
            expect(
                await deleteDraft(
                    ctx.db,
                    { ...owner, photoId: second },
                    new Date(closesAt + AUTO_SUBMIT_AFTER_CLOSE_MS + 1000),
                ),
            ).toEqual({ rejected: "closed" });
        },
        500_000,
    );

    integrationTest(
        "a draft the sweep has submitted cannot be deleted, even inside the grace minute",
        async ({ ctx }) => {
            const { event, member, cookie } = await openCamera(ctx);
            const id = await upload(ctx, cookie, event.id);
            const eventRow = await ctx.db.query.event.findFirst({
                where: { id: event.id },
            });
            const closesAt = cameraWindow(eventRow!).closesAt.getTime();
            // The sweep got there first: the delete's own checks passed on a
            // draft that is submitted by the time its DELETE runs.
            await ctx.db
                .update(schema.wrappedPhoto)
                .set({ submittedAt: new Date() })
                .where(eq(schema.wrappedPhoto.id, id));

            expect(
                await deleteDraft(
                    ctx.db,
                    { eventId: event.id, userId: member.id, photoId: id },
                    new Date(closesAt + 30_000),
                ),
            ).toEqual({ rejected: "submitted" });

            const row = await ctx.db.query.wrappedPhoto.findFirst({
                where: { id },
            });
            expect(row).toBeDefined();
            expect(await ctx.bucket.getAsset(row!.assetKey)).not.toBeNull();
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

            await closeAndSubmit(ctx, event.id);
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
