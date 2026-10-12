import { describe, expect, it } from "vitest";
import { blockedReason } from "~/lib/wrapped";
import { integrationTest } from "~/test/config/integration";
import { createOngoingEvent, enableCamera, register } from "./helpers";

const HOUR = 60 * 60 * 1000;

describe("why a member cannot take a photo", () => {
    const now = new Date();
    const open = {
        enabled: true,
        opensAt: new Date(now.getTime() - HOUR),
        closesAt: new Date(now.getTime() + HOUR),
        hasSpot: true,
        shotsLeft: 1,
        now,
    };

    it("is nothing when the camera is on, open, and the member has a spot and photos left", () => {
        expect(blockedReason(open)).toBeNull();
    });

    it("reports the first reason that applies, in the documented order", () => {
        const everythingWrong = {
            ...open,
            enabled: false,
            opensAt: new Date(now.getTime() + HOUR),
            hasSpot: false,
            shotsLeft: 0,
        };

        expect(blockedReason(everythingWrong)).toBe("disabled");
        expect(blockedReason({ ...everythingWrong, enabled: true })).toBe(
            "not_open_yet",
        );
        expect(
            blockedReason({
                ...everythingWrong,
                enabled: true,
                opensAt: new Date(now.getTime() - 2 * HOUR),
                closesAt: new Date(now.getTime() - HOUR),
            }),
        ).toBe("closed");
        expect(blockedReason({ ...open, hasSpot: false, shotsLeft: 0 })).toBe(
            "not_registered",
        );
        expect(blockedReason({ ...open, shotsLeft: 0 })).toBe("no_shots_left");
    });
});

describe("wrapped camera status", () => {
    integrationTest(
        "an event whose camera was never configured answers as disabled",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event[":eventId"].wrapped.$get({
                param: { eventId: event.id },
            });

            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                enabled: false,
                shotsPerPerson: 5,
                isOpen: false,
                canShoot: false,
                reason: "disabled",
                canManage: false,
            });
        },
        500_000,
    );

    integrationTest(
        "a registered member can shoot while the event is under way",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id, 3);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event[":eventId"].wrapped.$get({
                param: { eventId: event.id },
            });
            const body = await response.json();

            expect(body).toMatchObject({
                enabled: true,
                shotsPerPerson: 3,
                isOpen: true,
                shotsUsed: 0,
                shotsLeft: 3,
                canShoot: true,
                reason: null,
            });
            // Two hours before start, four hours after end.
            expect(body.opensAt).toBe(
                new Date(event.start.getTime() - 2 * HOUR).toISOString(),
            );
            expect(body.closesAt).toBe(
                new Date(event.end.getTime() + 4 * HOUR).toISOString(),
            );
        },
        500_000,
    );

    integrationTest(
        "the camera is closed before and after its window",
        async ({ ctx }) => {
            const now = Date.now();
            const upcoming = await createOngoingEvent(ctx, {
                start: new Date(now + 3 * HOUR),
                end: new Date(now + 5 * HOUR),
            });
            const past = await createOngoingEvent(ctx, {
                start: new Date(now - 8 * HOUR),
                end: new Date(now - 5 * HOUR),
            });
            const member = await ctx.utils.createTestUser();
            for (const event of [upcoming, past]) {
                await enableCamera(ctx, event.id);
                await register(ctx, event.id, member.id);
            }
            const client = await ctx.utils.clientForUser(member);

            const before = await client.api.event[":eventId"].wrapped.$get({
                param: { eventId: upcoming.id },
            });
            const after = await client.api.event[":eventId"].wrapped.$get({
                param: { eventId: past.id },
            });

            expect(await before.json()).toMatchObject({
                isOpen: false,
                canShoot: false,
                reason: "not_open_yet",
            });
            expect(await after.json()).toMatchObject({
                isOpen: false,
                canShoot: false,
                reason: "closed",
            });
        },
        500_000,
    );

    integrationTest(
        "only members holding a spot can shoot",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            await enableCamera(ctx, event.id);

            const stranger = await ctx.utils.createTestUser();
            const queued = await ctx.utils.createTestUser();
            const noShow = await ctx.utils.createTestUser();
            await register(ctx, event.id, queued.id, "waitlisted");
            // The no-show sweep runs while the camera is still open.
            await register(ctx, event.id, noShow.id, "no_show");

            const reasonFor = async (
                user: Awaited<ReturnType<typeof ctx.utils.createTestUser>>,
            ) => {
                const client = await ctx.utils.clientForUser(user);
                const response = await client.api.event[
                    ":eventId"
                ].wrapped.$get({ param: { eventId: event.id } });
                return (await response.json()).reason;
            };

            expect(await reasonFor(stranger)).toBe("not_registered");
            expect(await reasonFor(queued)).toBe("not_registered");
            expect(await reasonFor(noShow)).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "an unknown event is not found",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event[":eventId"].wrapped.$get({
                param: { eventId: crypto.randomUUID() },
            });

            expect(response.status).toBe(404);
        },
        500_000,
    );
});

describe("wrapped camera settings", () => {
    integrationTest(
        "the organizer turns the camera on and sets the number of photos",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            const on = await client.api.event[":eventId"].wrapped.$put({
                param: { eventId: event.id },
                json: { enabled: true, shotsPerPerson: 8 },
            });

            expect(on.status).toBe(200);
            expect(await on.json()).toMatchObject({
                enabled: true,
                shotsPerPerson: 8,
                canManage: true,
            });

            // Omitting the number keeps it, rather than resetting to 5.
            const off = await client.api.event[":eventId"].wrapped.$put({
                param: { eventId: event.id },
                json: { enabled: false },
            });

            expect(await off.json()).toMatchObject({
                enabled: false,
                shotsPerPerson: 8,
            });
        },
        500_000,
    );

    integrationTest(
        "a member who does not arrange the event cannot change the camera",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event[":eventId"].wrapped.$put({
                param: { eventId: event.id },
                json: { enabled: true },
            });

            expect(response.status).toBe(403);
            expect(
                await ctx.db.query.wrappedCamera.findFirst({
                    where: (camera, { eq }) => eq(camera.eventId, event.id),
                }),
            ).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "an event id that is not a uuid is a bad request, not a server error",
        async ({ ctx }) => {
            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            const response = await client.api.event[":eventId"].wrapped.$put({
                param: { eventId: "not-a-uuid" },
                json: { enabled: true },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "the number of photos must be between 1 and 20",
        async ({ ctx }) => {
            const event = await createOngoingEvent(ctx);
            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            for (const shotsPerPerson of [0, 21]) {
                const response = await client.api.event[
                    ":eventId"
                ].wrapped.$put({
                    param: { eventId: event.id },
                    json: { enabled: true, shotsPerPerson },
                });

                expect(response.status).toBe(400);
            }
        },
        500_000,
    );
});
