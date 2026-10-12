import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { insertPhotoIfAllowed } from "~/lib/wrapped/quota";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import {
    createOngoingEvent,
    enableCamera,
    register,
    sessionCookie,
    uploadPhoto,
} from "./helpers";

const PNG = { type: "image/png", name: "bilde.png" };

function photosBy(ctx: IntegrationTestContext, userId: string) {
    return ctx.db.query.wrappedPhoto.findMany({
        where: eq(schema.wrappedPhoto.uploadedById, userId),
    });
}

function assetsBy(ctx: IntegrationTestContext, userId: string) {
    return ctx.db.query.asset.findMany({
        where: eq(schema.asset.uploadedById, userId),
    });
}

describe("wrapped photo upload", () => {
    integrationTest(
        "a photo is stored hidden and costs one shot",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id, 3);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);

            const response = await uploadPhoto(
                ctx,
                await sessionCookie(ctx, member),
                event.id,
            );

            expect(response.status).toBe(201);
            const body = (await response.json()) as {
                id: string;
                shotsUsed: number;
                shotsLeft: number;
            };
            // Counts and an id — never anything that locates the image.
            expect(Object.keys(body).sort()).toEqual([
                "id",
                "shotsLeft",
                "shotsUsed",
            ]);
            expect(body).toMatchObject({ shotsUsed: 1, shotsLeft: 2 });

            const [photo] = await photosBy(ctx, member.id);
            expect(photo).toMatchObject({
                id: body.id,
                eventId: event.id,
                selectedAt: null,
            });

            const asset = await ctx.bucket.getAsset(photo!.assetKey);
            expect(asset).toMatchObject({
                visibility: "private",
                // Promoted, so the two-day staging cleanup leaves it alone.
                status: "ready",
            });
        },
        500_000,
    );

    integrationTest(
        "the open asset route never serves a wrapped photo, not even to its photographer",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            await uploadPhoto(ctx, await sessionCookie(ctx, member), event.id);
            const [photo] = await photosBy(ctx, member.id);

            const client = await ctx.utils.clientForUser(member);
            const signedIn = await client.api.assets[":key{.+}"].$get({
                param: { key: photo!.assetKey },
            });
            const anonymous = await ctx.app.request(
                `/api/assets/${photo!.assetKey}`,
            );

            expect(signedIn.status).toBe(404);
            expect(anonymous.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "a member without a spot, or a camera that is off, is refused and nothing is stored",
        async ({ ctx }) => {
            const open = await createOngoingEvent(ctx);
            await enableCamera(ctx, open.id);
            const off = await createOngoingEvent(ctx);

            const member = await ctx.utils.createTestUser();
            await register(ctx, off.id, member.id);
            const cookie = await sessionCookie(ctx, member);

            const noSpot = await uploadPhoto(ctx, cookie, open.id);
            const cameraOff = await uploadPhoto(ctx, cookie, off.id);

            expect(noSpot.status).toBe(403);
            expect(await noSpot.json()).toMatchObject({
                meta: { reason: "not_registered" },
            });
            expect(cameraOff.status).toBe(403);
            expect(await cameraOff.json()).toMatchObject({
                meta: { reason: "disabled" },
            });
            expect(await photosBy(ctx, member.id)).toEqual([]);
            expect(await assetsBy(ctx, member.id)).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "the photo after the last one is a conflict",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id, 1);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const cookie = await sessionCookie(ctx, member);

            const first = await uploadPhoto(ctx, cookie, event.id);
            const second = await uploadPhoto(ctx, cookie, event.id);

            expect(first.status).toBe(201);
            expect(await first.json()).toMatchObject({ shotsLeft: 0 });
            expect(second.status).toBe(409);
            expect(await photosBy(ctx, member.id)).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "a burst of uploads stops at the limit and leaves no stray files",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id, 2);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const cookie = await sessionCookie(ctx, member);

            const responses = await Promise.all(
                Array.from({ length: 6 }, () =>
                    uploadPhoto(ctx, cookie, event.id),
                ),
            );

            const statuses = responses.map((r) => r.status).sort();
            expect(statuses).toEqual([201, 201, 409, 409, 409, 409]);
            expect(await photosBy(ctx, member.id)).toHaveLength(2);
            // A rejected upload that had already stored its file removes it.
            expect(await assetsBy(ctx, member.id)).toHaveLength(2);
        },
        500_000,
    );

    integrationTest(
        "the camera is asked again when the photo is recorded, not only when the upload started",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id, 5);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const photo = (n: number) => ({
                eventId: event.id,
                userId: member.id,
                assetKey: `uploads/2026/11/photo-${n}.webp`,
            });

            expect(await insertPhotoIfAllowed(ctx.db, photo(1))).toMatchObject({
                shotsUsed: 1,
                shotsLeft: 4,
            });

            // What a slow upload would meet: the organizer lowered the limit
            // or turned the camera off while the file was on its way.
            await ctx.db
                .update(schema.wrappedCamera)
                .set({ shotsPerPerson: 1 })
                .where(eq(schema.wrappedCamera.eventId, event.id));
            expect(await insertPhotoIfAllowed(ctx.db, photo(2))).toEqual({
                rejected: "no_shots_left",
            });

            await ctx.db
                .update(schema.wrappedCamera)
                .set({ enabled: false })
                .where(eq(schema.wrappedCamera.eventId, event.id));
            expect(await insertPhotoIfAllowed(ctx.db, photo(3))).toEqual({
                rejected: "disabled",
            });

            expect(await photosBy(ctx, member.id)).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "sending the same photo again under the same key costs nothing, even when it was the last one",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id, 1);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const cookie = await sessionCookie(ctx, member);
            const key = crypto.randomUUID();

            const first = await uploadPhoto(ctx, cookie, event.id, PNG, key);
            // What the client does when the answer to the first never arrived.
            const again = await uploadPhoto(ctx, cookie, event.id, PNG, key);

            expect(first.status).toBe(201);
            expect(again.status).toBe(200);
            expect(await again.json()).toEqual({
                id: key,
                shotsUsed: 1,
                shotsLeft: 0,
            });
            expect(await photosBy(ctx, member.id)).toHaveLength(1);
            expect(await assetsBy(ctx, member.id)).toHaveLength(1);

            // The same answer from the step that holds the lock, which is
            // where two attempts arriving together are told apart.
            expect(
                await insertPhotoIfAllowed(ctx.db, {
                    eventId: event.id,
                    userId: member.id,
                    assetKey: "uploads/2026/11/spare.webp",
                    id: key,
                }),
            ).toMatchObject({ id: key, replayed: true });
        },
        500_000,
    );

    integrationTest(
        "a key that belongs to someone else's photo is refused",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id);
            const owner = await ctx.utils.createTestUser();
            const other = await ctx.utils.createTestUser();
            await register(ctx, event.id, owner.id);
            await register(ctx, event.id, other.id);
            const key = crypto.randomUUID();
            await uploadPhoto(
                ctx,
                await sessionCookie(ctx, owner),
                event.id,
                PNG,
                key,
            );

            const response = await uploadPhoto(
                ctx,
                await sessionCookie(ctx, other),
                event.id,
                PNG,
                key,
            );

            expect(response.status).toBe(400);
            expect(await photosBy(ctx, other.id)).toEqual([]);
            expect(await assetsBy(ctx, other.id)).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "only images are accepted, and a missing file is a bad request",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const cookie = await sessionCookie(ctx, member);

            const pdf = await uploadPhoto(ctx, cookie, event.id, {
                type: "application/pdf",
                name: "notat.pdf",
            });
            const empty = await ctx.app.request(
                `/api/event/${event.id}/wrapped/photos`,
                {
                    method: "POST",
                    body: new FormData(),
                    headers: { Cookie: cookie },
                },
            );

            expect(pdf.status).toBe(400);
            expect(empty.status).toBe(400);
            expect(await photosBy(ctx, member.id)).toEqual([]);
        },
        500_000,
    );
});
