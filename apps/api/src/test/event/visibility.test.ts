import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("event visibility", () => {
    integrationTest(
        "members-only events are hidden from the list for unauthenticated callers",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const publicEvent = await ctx.utils.createTestEvent({
                title: "Public Event",
                slug: `public-${Date.now()}`,
                visibility: "public",
            });
            const membersEvent = await ctx.utils.createTestEvent({
                title: "Members Event",
                slug: `members-${Date.now()}`,
                visibility: "members",
            });

            const anonClient = ctx.utils.client();
            const response = await anonClient.api.event.$get({ query: {} });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(publicEvent.id);
            expect(ids).not.toContain(membersEvent.id);
        },
        500_000,
    );

    integrationTest(
        "members-only events appear in the list for authenticated members",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const membersEvent = await ctx.utils.createTestEvent({
                title: "Members Event",
                slug: `members-${Date.now()}`,
                visibility: "members",
            });

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event.$get({ query: {} });
            expect(response.status).toBe(200);
            const body = await response.json();

            const ids = body.items.map((e) => e.id);
            expect(ids).toContain(membersEvent.id);
        },
        500_000,
    );

    integrationTest(
        "getting a members-only event by id returns 404 for unauthenticated callers",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const membersEvent = await ctx.utils.createTestEvent({
                title: "Members Event",
                slug: `members-${Date.now()}`,
                visibility: "members",
            });

            const anonClient = ctx.utils.client();
            const response = await anonClient.api.event[":eventId"].$get({
                param: { eventId: membersEvent.id },
            });
            expect(response.status).toBe(404);
        },
        500_000,
    );

    integrationTest(
        "getting a members-only event by id succeeds for authenticated members",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const membersEvent = await ctx.utils.createTestEvent({
                title: "Members Event",
                slug: `members-${Date.now()}`,
                visibility: "members",
            });

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);
            const response = await client.api.event[":eventId"].$get({
                param: { eventId: membersEvent.id },
            });
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toMatchObject({
                id: membersEvent.id,
                visibility: "members",
            });
        },
        500_000,
    );

    integrationTest(
        "creating an event persists the chosen visibility",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: {
                    title: "Members Only Event",
                    description: "A members-only event",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Oslo, Norway",
                    imageUrl: null,
                    start: "2025-12-01T18:00:00Z",
                    end: "2025-12-01T20:00:00Z",
                    registrationStart: null,
                    registrationEnd: "2025-11-30T23:59:59Z",
                    cancellationDeadline: null,
                    capacity: 50,
                    visibility: "members",
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });
            expect(response.status).toBe(201);
            const { eventId } = await response.json();

            const detail = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(detail.status).toBe(200);
            const body = await detail.json();
            expect(body).toMatchObject({ visibility: "members" });
        },
        500_000,
    );
});
