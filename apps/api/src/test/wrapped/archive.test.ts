import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { semesterOf, semesterRange } from "~/lib/wrapped/archive";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";
import {
    createOngoingEvent,
    enableCamera,
    eventWithPickedPhotos,
    markPublished,
    register,
} from "./helpers";

const HOUR = 60 * 60 * 1000;

/** An event that started at `start`, with a published story and no photos. */
async function publishedEvent(ctx: IntegrationTestContext, start: Date) {
    const event = await createOngoingEvent(ctx, {
        start,
        end: new Date(start.getTime() + 3 * HOUR),
    });
    await enableCamera(ctx, event.id);
    await markPublished(ctx, event.id);
    return event;
}

async function archiveFor(
    ctx: IntegrationTestContext,
    user: Parameters<IntegrationTestContext["utils"]["clientForUser"]>[0],
    query: { semester?: string; page?: string; pageSize?: string } = {},
) {
    const client = await ctx.utils.clientForUser(user);
    return client.api.event.wrapped.archive.$get({ query });
}

describe("semesters", () => {
    it("are read in Norwegian time", () => {
        // 30 June 23:30 in Oslo, still spring.
        expect(semesterOf(new Date("2026-06-30T21:30:00Z"))).toBe("V2026");
        // 1 July 00:30 in Oslo, already autumn, while still June in UTC.
        expect(semesterOf(new Date("2026-06-30T22:30:00Z"))).toBe("H2026");
        // New Year's Eve 23:30 in Oslo, and the first half hour of the year.
        expect(semesterOf(new Date("2026-12-31T22:30:00Z"))).toBe("H2026");
        expect(semesterOf(new Date("2026-12-31T23:30:00Z"))).toBe("V2027");
    });

    it("span from Oslo midnight to Oslo midnight", () => {
        expect(semesterRange("V2026")).toEqual({
            from: new Date("2025-12-31T23:00:00Z"),
            to: new Date("2026-06-30T22:00:00Z"),
        });
        expect(semesterRange("H2026")).toEqual({
            from: new Date("2026-06-30T22:00:00Z"),
            to: new Date("2026-12-31T23:00:00Z"),
        });
    });
});

describe("wrapped archive", () => {
    integrationTest(
        "lists the published stories of events the member was at, with counts and a cover",
        async ({ ctx }) => {
            const { event, photographer } = await eventWithPickedPhotos(ctx, 3);
            const photos = await ctx.db.query.wrappedPhoto.findMany({
                orderBy: { createdAt: "asc", id: "asc" },
            });
            // One photo not picked: it must not count.
            await ctx.db
                .update(schema.wrappedPhoto)
                .set({ selectedAt: null })
                .where(eq(schema.wrappedPhoto.id, photos[2]!.id));
            await markPublished(ctx, event.id);

            // Someone who was there but took no photos sees it too.
            const guest = await ctx.utils.createTestUser();
            await register(ctx, event.id, guest.id, "attended");

            // A published story of an event neither was at.
            await publishedEvent(ctx, new Date(Date.now() - 48 * HOUR));

            const response = await archiveFor(ctx, photographer);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.totalCount).toBe(1);
            expect(body.nextPage).toBeNull();
            expect(body.items[0]).toMatchObject({
                event: { id: event.id, slug: event.slug, title: event.title },
                layout: "feed",
                photoCount: 2,
                myPhotoCount: 2,
                coverImageUrl: `/api/event/${event.id}/wrapped/story/photos/${photos[0]!.id}/image`,
            });

            const asGuest = await (await archiveFor(ctx, guest)).json();
            expect(asGuest.items.map((item) => item.event.id)).toEqual([
                event.id,
            ]);
            expect(asGuest.items[0]).toMatchObject({
                photoCount: 2,
                myPhotoCount: 0,
            });
        },
        500_000,
    );

    integrationTest(
        "only registered or attended members, or those who sent in a photo, took part",
        async ({ ctx }) => {
            const event = await publishedEvent(
                ctx,
                new Date(Date.now() - 48 * HOUR),
            );

            const outsiders: RegistrationStatus[] = [
                "waitlisted",
                "cancelled",
                "no_show",
                "pending",
            ];
            for (const status of outsiders) {
                const user = await ctx.utils.createTestUser();
                await register(ctx, event.id, user.id, status);
                const body = await (await archiveFor(ctx, user)).json();
                expect(body.totalCount, status).toBe(0);
            }

            // Sent in a photo without a registration: an organizer, say.
            const photographer = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.wrappedPhoto).values({
                eventId: event.id,
                uploadedById: photographer.id,
                assetKey: `wrapped/${crypto.randomUUID()}`,
                submittedAt: new Date(),
            });
            const body = await (await archiveFor(ctx, photographer)).json();
            expect(body.totalCount).toBe(1);
            // Not picked, so no photo to show.
            expect(body.items[0]).toMatchObject({
                photoCount: 0,
                myPhotoCount: 0,
                coverImageUrl: null,
            });

            // A draft is not sending a photo in.
            const drafter = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.wrappedPhoto).values({
                eventId: event.id,
                uploadedById: drafter.id,
                assetKey: `wrapped/${crypto.randomUUID()}`,
            });
            expect(
                (await (await archiveFor(ctx, drafter)).json()).totalCount,
            ).toBe(0);
        },
        500_000,
    );

    integrationTest(
        "an unpublished story leaves the archive and comes back when published",
        async ({ ctx }) => {
            const event = await publishedEvent(
                ctx,
                new Date(Date.now() - 48 * HOUR),
            );
            const member = await ctx.utils.createTestUser();
            await register(ctx, event.id, member.id);
            expect(
                (await (await archiveFor(ctx, member)).json()).totalCount,
            ).toBe(1);

            await ctx.db
                .update(schema.wrappedCamera)
                .set({ publishedAt: null })
                .where(eq(schema.wrappedCamera.eventId, event.id));
            expect(
                (await (await archiveFor(ctx, member)).json()).totalCount,
            ).toBe(0);

            await markPublished(ctx, event.id);
            expect(
                (await (await archiveFor(ctx, member)).json()).totalCount,
            ).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "filters by semester, and lists every semester newest first",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const lastOfSpring = await publishedEvent(
                ctx,
                new Date("2026-06-30T21:30:00Z"),
            );
            const firstOfAutumn = await publishedEvent(
                ctx,
                new Date("2026-06-30T22:30:00Z"),
            );
            const lateAutumn = await publishedEvent(
                ctx,
                new Date("2026-11-20T17:00:00Z"),
            );
            const lastYear = await publishedEvent(
                ctx,
                new Date("2025-10-01T16:00:00Z"),
            );
            for (const event of [
                lastOfSpring,
                firstOfAutumn,
                lateAutumn,
                lastYear,
            ]) {
                await register(ctx, event.id, member.id);
            }

            const all = await (await archiveFor(ctx, member)).json();
            expect(all.semesters).toEqual(["H2026", "V2026", "H2025"]);
            expect(all.items.map((item) => item.event.id)).toEqual([
                lateAutumn.id,
                firstOfAutumn.id,
                lastOfSpring.id,
                lastYear.id,
            ]);
            expect(all.items.map((item) => item.semester)).toEqual([
                "H2026",
                "H2026",
                "V2026",
                "H2025",
            ]);

            const autumn = await (
                await archiveFor(ctx, member, { semester: "H2026" })
            ).json();
            expect(autumn.items.map((item) => item.event.id)).toEqual([
                lateAutumn.id,
                firstOfAutumn.id,
            ]);
            // The filter still offers every semester.
            expect(autumn.semesters).toEqual(["H2026", "V2026", "H2025"]);

            const spring = await (
                await archiveFor(ctx, member, { semester: "V2026" })
            ).json();
            expect(spring.items.map((item) => item.event.id)).toEqual([
                lastOfSpring.id,
            ]);

            const empty = await (
                await archiveFor(ctx, member, { semester: "V2024" })
            ).json();
            expect(empty.totalCount).toBe(0);
            expect(empty.items).toEqual([]);
        },
        500_000,
    );

    integrationTest(
        "pages through the archive",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            for (let i = 1; i <= 3; i++) {
                const event = await publishedEvent(
                    ctx,
                    new Date(Date.now() - i * 48 * HOUR),
                );
                await register(ctx, event.id, member.id);
            }

            const first = await (
                await archiveFor(ctx, member, { page: "0", pageSize: "2" })
            ).json();
            expect(first).toMatchObject({
                totalCount: 3,
                pages: 2,
                nextPage: 1,
            });
            expect(first.items).toHaveLength(2);

            const second = await (
                await archiveFor(ctx, member, { page: "1", pageSize: "2" })
            ).json();
            expect(second.nextPage).toBeNull();
            expect(second.items).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "rejects a malformed semester",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            for (const semester of ["2026", "h2026", "S2026", "V26"]) {
                const response = await archiveFor(ctx, member, { semester });
                expect(response.status, semester).toBe(400);
            }
        },
        500_000,
    );

    integrationTest(
        "logged out gets 401",
        async ({ ctx }) => {
            const response = await ctx.app.request(
                "/api/event/wrapped/archive",
            );
            expect(response.status).toBe(401);
        },
        500_000,
    );
});
