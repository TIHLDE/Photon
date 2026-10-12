import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import {
    createOngoingEvent,
    enableCamera,
    register,
    sessionCookie,
    uploadPhoto,
} from "./helpers";

const HOUR = 60 * 60 * 1000;

describe("the cameras open for a member right now", () => {
    integrationTest(
        "lists the event they are at, and nothing they cannot shoot at",
        async ({ ctx }) => {
            const now = Date.now();
            const here = await createOngoingEvent(ctx, { title: "Festen" });
            const cameraOff = await createOngoingEvent(ctx);
            const notRegistered = await createOngoingEvent(ctx);
            const queued = await createOngoingEvent(ctx);
            const nextWeek = await createOngoingEvent(ctx, {
                start: new Date(now + 7 * 24 * HOUR),
                end: new Date(now + 7 * 24 * HOUR + 2 * HOUR),
            });
            const longOver = await createOngoingEvent(ctx, {
                start: new Date(now - 10 * HOUR),
                end: new Date(now - 6 * HOUR),
            });

            const member = await ctx.utils.createTestUser();
            for (const event of [
                here,
                notRegistered,
                queued,
                nextWeek,
                longOver,
            ]) {
                await enableCamera(ctx, event.id, 3);
            }
            for (const event of [here, cameraOff, nextWeek, longOver]) {
                await register(ctx, event.id, member.id);
            }
            await register(ctx, queued.id, member.id, "waitlisted");
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event.wrapped.open.$get();

            expect(response.status).toBe(200);
            const cameras = await response.json();
            expect(cameras).toHaveLength(1);
            expect(cameras[0]).toMatchObject({
                eventId: here.id,
                slug: here.slug,
                title: "Festen",
                shotsPerPerson: 3,
                shotsLeft: 3,
                closesAt: new Date(here.end.getTime() + 4 * HOUR).toISOString(),
            });
        },
        500_000,
    );

    integrationTest(
        "puts the event that started last on top, and drops a camera once the photos are spent",
        async ({ ctx }) => {
            const now = Date.now();
            // A meeting that is over but whose camera is still open, the party
            // that just began, and one whose camera has opened ahead of it.
            const meeting = await createOngoingEvent(ctx, {
                title: "Møtet",
                start: new Date(now - 6 * HOUR),
                end: new Date(now - 2 * HOUR),
            });
            const party = await createOngoingEvent(ctx, {
                title: "Festen",
                start: new Date(now - HOUR / 2),
                end: new Date(now + 4 * HOUR),
            });
            const allDay = await createOngoingEvent(ctx, {
                title: "Hele dagen",
                start: new Date(now - 5 * HOUR),
                end: new Date(now + 5 * HOUR),
            });
            const soon = await createOngoingEvent(ctx, {
                title: "Snart",
                start: new Date(now + HOUR),
                end: new Date(now + 3 * HOUR),
            });

            const member = await ctx.utils.createTestUser();
            for (const event of [meeting, party, allDay, soon]) {
                await enableCamera(ctx, event.id, 1);
                await register(ctx, event.id, member.id);
            }
            const client = await ctx.utils.clientForUser(member);
            const titles = async () =>
                (await (await client.api.event.wrapped.open.$get()).json()).map(
                    (camera) => camera.title,
                );

            expect(await titles()).toEqual([
                "Festen",
                "Hele dagen",
                "Snart",
                "Møtet",
            ]);

            await uploadPhoto(ctx, await sessionCookie(ctx, member), party.id);

            expect(await titles()).toEqual(["Hele dagen", "Snart", "Møtet"]);
        },
        500_000,
    );

    integrationTest(
        "requires a session",
        async ({ ctx }) => {
            const response = await ctx.app.request("/api/event/wrapped/open");

            expect(response.status).toBe(401);
        },
        500_000,
    );
});
