import { assignUserRole, createTestingRole } from "@photon/auth/roles";
import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

/**
 * Å åpne ett arrangement for alumni.
 *
 * Retten til å melde seg på er en rolletilgang, ikke noe ved arrangementet, og
 * `alumni` er nettopp `member` uten den. Det gjorde «slipp alumni inn på denne
 * ene julebordet» umulig å si: den eneste bryteren som fantes ga dem
 * påmelding til alt.
 *
 * Testene sjekker derfor begge sider av flagget — at det åpner arrangementet
 * det står på, og at det ikke åpner noe annet.
 */
describe("event open to alumni", () => {
    /** De to baseline-rollene slik produksjon seeder dem. */
    async function seedBaselineRoles(ctx: IntegrationTestContext) {
        await createTestingRole(ctx, {
            name: "member",
            description: "Baseline member role",
            permissions: ["events:registrations:create"],
            position: 2,
        });
        await createTestingRole(ctx, {
            name: "alumni",
            description: "Baseline alumni role",
            permissions: [],
            position: 1,
        });
    }

    async function createAlumnus(ctx: IntegrationTestContext) {
        const alumnus = await ctx.utils.createTestUser();
        await assignUserRole(ctx, alumnus.id, "alumni");
        await ctx.utils.acceptEventRules(alumnus.id);
        return alumnus;
    }

    integrationTest(
        "an alumnus may register for an event opened to alumni",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                slug: `alumni-open-${Date.now()}`,
                openToAlumni: true,
            });

            const alumnus = await createAlumnus(ctx);
            const client = await ctx.utils.clientForUser(alumnus);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "the same alumnus is still rejected by every other event",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const open = await ctx.utils.createTestEvent({
                slug: `alumni-open-${Date.now()}`,
                openToAlumni: true,
            });
            const closed = await ctx.utils.createTestEvent({
                slug: `members-only-${Date.now()}`,
            });

            const alumnus = await createAlumnus(ctx);
            const client = await ctx.utils.clientForUser(alumnus);

            const allowed = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: open.id },
                json: {},
            });
            expect(allowed.status).toBe(200);

            // Flagget står på det ene arrangementet, ikke på kontoen.
            const rejected = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: closed.id },
                json: {},
            });
            expect(rejected.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "an account without either baseline role is still rejected",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                slug: `alumni-open-${Date.now()}`,
                openToAlumni: true,
            });

            // En konto som venter på godkjenning har ingen av rollene. Flagget
            // sier «alumni», ikke «alle», og skal ikke slippe den inn.
            const stranger = await ctx.utils.createTestUser();
            await ctx.utils.acceptEventRules(stranger.id);
            const client = await ctx.utils.clientForUser(stranger);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "the flag survives create, read and update",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const arranger = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(arranger, [
                "events:create",
                "events:update",
                "events:view",
            ]);
            const client = await ctx.utils.clientForUser(arranger);

            const created = await client.api.event.$post({
                json: {
                    title: "Alumnifest",
                    description: "Åpen for dem som har gått ut",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Trondheim",
                    imageUrl: null,
                    start: "2026-12-01T18:00:00Z",
                    end: "2026-12-01T20:00:00Z",
                    registrationStart: null,
                    registrationEnd: "2026-11-30T23:59:59Z",
                    cancellationDeadline: null,
                    capacity: 50,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    openToAlumni: true,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });
            expect(created.status).toBe(201);
            const { eventId } = await created.json();

            // Redigeringsskjemaet fylles fra detaljvisningen, så flagget må
            // være med der for at avhukingen skal overleve en runde i skjemaet.
            const afterCreate = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(afterCreate.status).toBe(200);
            expect(await afterCreate.json()).toMatchObject({
                openToAlumni: true,
            });

            const updated = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { openToAlumni: false },
            });
            expect(updated.status).toBe(200);

            const afterUpdate = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(await afterUpdate.json()).toMatchObject({
                openToAlumni: false,
            });
        },
        500_000,
    );

    integrationTest(
        "an active member registers as before, flag or no flag",
        async ({ ctx }) => {
            await seedBaselineRoles(ctx);
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent({
                slug: `members-only-${Date.now()}`,
            });

            const member = await ctx.utils.createTestUser();
            await assignUserRole(ctx, member.id, "member");
            await ctx.utils.acceptEventRules(member.id);
            const client = await ctx.utils.clientForUser(member);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(200);
        },
        500_000,
    );
});
