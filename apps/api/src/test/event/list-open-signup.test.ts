import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("event list openSignUp filter", () => {
    integrationTest(
        "returns only events whose registration window is open right now",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const now = Date.now();

            // Vinduet omslutter nå — den eneste som skal bli med.
            const open = await ctx.utils.createTestEvent({
                title: "Open",
                slug: `open-${now}`,
                registrationStart: new Date(now - HOUR),
                registrationEnd: new Date(now + DAY),
            });
            const notOpenYet = await ctx.utils.createTestEvent({
                title: "Not open yet",
                slug: `not-open-yet-${now}`,
                registrationStart: new Date(now + DAY),
                registrationEnd: new Date(now + 2 * DAY),
            });
            const deadlinePassed = await ctx.utils.createTestEvent({
                title: "Deadline passed",
                slug: `deadline-passed-${now}`,
                registrationStart: new Date(now - 2 * DAY),
                registrationEnd: new Date(now - DAY),
            });
            // `isRegistrationClosed` overstyrer vinduet, slik den gjør ellers.
            const manuallyClosed = await ctx.utils.createTestEvent({
                title: "Manually closed",
                slug: `manually-closed-${now}`,
                registrationStart: new Date(now - HOUR),
                registrationEnd: new Date(now + DAY),
                isRegistrationClosed: true,
            });
            const noSignUp = await ctx.utils.createTestEvent({
                title: "No sign-up",
                slug: `no-signup-${now}`,
                requiresSigningUp: false,
                registrationStart: null,
                registrationEnd: null,
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({
                query: { openSignUp: "true" },
            });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(open.id);
            expect(ids).not.toContain(notOpenYet.id);
            expect(ids).not.toContain(deadlinePassed.id);
            expect(ids).not.toContain(manuallyClosed.id);
            expect(ids).not.toContain(noSignUp.id);
            // totalCount driver pagineringen, så den må filtreres like hardt.
            expect(body.totalCount).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "treats missing registration bounds as no bound, not as closed",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const now = Date.now();

            // Null betyr «åpnet med én gang» og «ingen frist». Uten eksplisitt
            // null-håndtering faller begge ut av et vindusfilter, og et
            // arrangement som tar imot påmeldinger ser stengt ut.
            const noBounds = await ctx.utils.createTestEvent({
                title: "No bounds",
                slug: `no-bounds-${now}`,
                registrationStart: null,
                registrationEnd: null,
            });
            const noStart = await ctx.utils.createTestEvent({
                title: "No start",
                slug: `no-start-${now}`,
                registrationStart: null,
                registrationEnd: new Date(now + DAY),
            });
            const noEnd = await ctx.utils.createTestEvent({
                title: "No end",
                slug: `no-end-${now}`,
                registrationStart: new Date(now - HOUR),
                registrationEnd: null,
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({
                query: { openSignUp: "true" },
            });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(noBounds.id);
            expect(ids).toContain(noStart.id);
            expect(ids).toContain(noEnd.id);
            expect(body.totalCount).toBe(3);
        },
        500_000,
    );

    integrationTest(
        "omitting openSignUp keeps events regardless of registration state",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();

            const now = Date.now();

            const open = await ctx.utils.createTestEvent({
                title: "Open",
                slug: `open-all-${now}`,
                registrationStart: new Date(now - HOUR),
                registrationEnd: new Date(now + DAY),
            });
            const closed = await ctx.utils.createTestEvent({
                title: "Closed",
                slug: `closed-all-${now}`,
                isRegistrationClosed: true,
            });

            const client = ctx.utils.client();
            const response = await client.api.event.$get({ query: {} });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(open.id);
            expect(ids).toContain(closed.id);
            expect(body.totalCount).toBe(2);
        },
        500_000,
    );
});
