import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

/**
 * The registration window belongs to the server.
 *
 * Until this was enforced here, `registrationStart` was a frontend rule: the
 * button unlocked at the right second, and a request that arrived earlier was
 * accepted anyway. Nine members were registered to the immatrikuleringsball
 * before it opened on 2026-08-21, the earliest by 16 seconds. The event did not
 * fill up that day, so it cost nobody a spot — on one that does, those are the
 * first spots.
 */
async function memberWhoMayRegister(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(user, ["events:registrations:create"]);
    await ctx.utils.acceptEventRules(user.id);
    return { user, client: await ctx.utils.clientForUser(user) };
}

describe("Registration window", () => {
    integrationTest(
        "refuses a sign-up that arrives before registration opens",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                registrationStart: new Date(now + HOUR),
                registrationEnd: new Date(now + 48 * HOUR),
                start: new Date(now + 72 * HOUR),
                end: new Date(now + 76 * HOUR),
            });

            const { client } = await memberWhoMayRegister(ctx);
            const res = await client.api.event[":eventId"].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(res.status).toBe(409);
            const body = (await res.json()) as unknown as { message: string };
            expect(body.message).toContain("not opened yet");

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "refuses a sign-up that arrives after the deadline",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                registrationStart: new Date(now - 48 * HOUR),
                registrationEnd: new Date(now - HOUR),
                start: new Date(now + 24 * HOUR),
                end: new Date(now + 28 * HOUR),
            });

            const { client } = await memberWhoMayRegister(ctx);
            const res = await client.api.event[":eventId"].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(res.status).toBe(409);
            const body = (await res.json()) as unknown as { message: string };
            expect(body.message).toContain("has closed");

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "lets a sign-up inside the window through",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                registrationStart: new Date(now - HOUR),
                registrationEnd: new Date(now + 48 * HOUR),
                start: new Date(now + 72 * HOUR),
                end: new Date(now + 76 * HOUR),
            });

            const { client } = await memberWhoMayRegister(ctx);
            const res = await client.api.event[":eventId"].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(res.status).toBe(200);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "an event with no window set stays open",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                registrationStart: null,
                registrationEnd: null,
                start: new Date(now + 72 * HOUR),
                end: new Date(now + 76 * HOUR),
            });

            const { client } = await memberWhoMayRegister(ctx);
            const res = await client.api.event[":eventId"].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(res.status).toBe(200);
        },
        500_000,
    );
});
