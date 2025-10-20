import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("create event", () => {
    integrationTest(
        "Test that creating an event works",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: {
                    title: "Test Event",
                    description: "A test event description",
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
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            const json = await response.json();

            expect(response.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "Test that creating an event with start date after end date fails",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: {
                    title: "Test Event",
                    description: "A test event description",
                    categorySlug: "bedpres",
                    organizerGroupSlug: "index",
                    location: "Oslo, Norway",
                    imageUrl: null,
                    start: "2025-12-01T20:00:00Z",
                    end: "2025-12-01T18:00:00Z",
                    registrationStart: null,
                    registrationEnd: "2025-11-30T23:59:59Z",
                    cancellationDeadline: null,
                    capacity: 50,
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "Test that creating an event with allowWaitlist = false works",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: {
                    title: "Test Event No Waitlist",
                    description: "A test event without waitlist",
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
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: false,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(response.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "Test that creating an event with contactPersonUserId works",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: {
                    title: "Test Event With Contact",
                    description: "A test event with contact person",
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
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: user.id,
                    reactionsAllowed: true,
                },
            });

            expect(response.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "Test that creating an event without events:create permission returns forbidden",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const response = await client.api.event.$post({
                json: {
                    title: "Test Event",
                    description: "A test event description",
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
                    isRegistrationClosed: false,
                    requiresSigningUp: true,
                    allowWaitlist: true,
                    priorityPools: null,
                    onlyAllowPrioritized: false,
                    canCauseStrikes: false,
                    enforcesPreviousStrikes: false,
                    isPaidEvent: false,
                    price: null,
                    paymentGracePeriodMinutes: null,
                    contactPersonUserId: null,
                    reactionsAllowed: true,
                },
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );
});
