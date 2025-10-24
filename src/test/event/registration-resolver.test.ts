import type { UserWithRole } from "better-auth/plugins";
import { describe, expect } from "vitest";
import { schema } from "~/db";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

describe("Registration Resolver", () => {
    describe("Basic Registration", () => {
        integrationTest(
            "User registers successfully when event has capacity",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                // Create test event with capacity for 10 users
                const event = await ctx.utils.createTestEvent({ capacity: 10 });

                // Create test user
                const user = await ctx.utils.createTestUser();

                // Create pending registration
                await ctx.utils.createPendingRegistration(event.id, user.id);

                // Run resolver
                await resolveRegistrationsForEvent(event.id, ctx);

                // Check registration was resolved to 'registered' status
                const registration =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (reg, { and, eq }) =>
                            and(
                                eq(reg.eventId, event.id),
                                eq(reg.userId, user.id),
                            ),
                    });

                expect(registration?.status).toBe("registered");
                expect(registration?.waitlistPosition).toBeNull();
            },
            500_000,
        );

        integrationTest(
            "User lands on waitlist when event is full",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                // Create test event with capacity for 1 user
                const event = await ctx.utils.createTestEvent({ capacity: 1 });

                // Create two test users
                const user1 = await ctx.utils.createTestUser();
                const user2Data = await ctx.auth.api.createUser({
                    body: {
                        email: "user2@test.com",
                        name: "User Two",
                        password: "test123!",
                    },
                });
                const user2 = user2Data.user;

                // Create first registration (will get the spot)
                await ctx.utils.createPendingRegistration(event.id, user1.id);

                // Wait a moment to ensure different timestamp
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Create second registration (should be waitlisted)
                await ctx.utils.createPendingRegistration(event.id, user2.id);

                // Run resolver
                await resolveRegistrationsForEvent(event.id, ctx);

                // Check first user got the spot
                const reg1 = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(
                            eq(reg.eventId, event.id),
                            eq(reg.userId, user1.id),
                        ),
                });
                expect(reg1?.status).toBe("registered");

                // Check second user was waitlisted
                const reg2 = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(
                            eq(reg.eventId, event.id),
                            eq(reg.userId, user2.id),
                        ),
                });
                expect(reg2?.status).toBe("waitlisted");
                expect(reg2?.waitlistPosition).toBe(1);
            },
            500_000,
        );

        integrationTest(
            "Unlimited capacity events never waitlist",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                // Create unlimited event
                const event = await ctx.utils.createTestEvent({
                    capacity: null,
                });

                // Create 100 test users and pending registrations
                const start = Date.now();
                const users: Array<Promise<void>> = [];

                async function createAndRegisterUser(i: number) {
                    const userData = await ctx.auth.api.createUser({
                        body: {
                            email: `user${i}@test.com`,
                            name: `User ${i}`,
                            password: "test123!",
                        },
                    });
                    await ctx.utils.createPendingRegistration(
                        event.id,
                        userData.user.id,
                    );
                }

                for (let i = 0; i < 10; i++) {
                    users.push(createAndRegisterUser(i));
                }

                await Promise.all(users);

                const end = Date.now();
                console.log(
                    `Created 100 users and registrations in ${end - start}ms`,
                );

                // Run resolver
                await resolveRegistrationsForEvent(event.id, ctx);

                // Check all users are registered
                const registrations =
                    await ctx.db.query.eventRegistration.findMany({
                        where: (reg, { eq }) => eq(reg.eventId, event.id),
                    });

                expect(registrations).toHaveLength(10);
                for (const reg of registrations) {
                    expect(reg.status).toBe("registered");
                    expect(reg.waitlistPosition).toBeNull();
                }
            },
            500_000,
        );
    });

    describe("Priority Pool System", () => {
        integrationTest(
            "Prioritized user gets spot even when event is full (swap)",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                await ctx.utils.setupGroups();

                // Create event with capacity of 1
                const event = await ctx.utils.createTestEvent({ capacity: 1 });

                // Create priority pool requiring membership in "index" group
                const [pool] = await ctx.db
                    .insert(schema.eventPriorityPool)
                    .values({ eventId: event.id, priorityScore: 1 })
                    .returning();

                if (!pool) {
                    throw new Error("Failed to create priority pool");
                }

                await ctx.db.insert(schema.eventPriorityPoolGroup).values({
                    priorityPoolId: pool.id,
                    groupSlug: "index",
                });

                // Create non-prioritized user
                const nonPrioritizedUser = await ctx.utils.createTestUser();

                // Create prioritized user (member of index group)
                const prioritizedUserData = await ctx.auth.api.createUser({
                    body: {
                        email: "prioritized@test.com",
                        name: "Prioritized User",
                        password: "test123!",
                    },
                });
                const prioritizedUser = prioritizedUserData.user;

                // Add prioritized user to index group
                await ctx.db.insert(schema.groupMembership).values({
                    userId: prioritizedUser.id,
                    groupSlug: "index",
                    role: "member",
                });

                // Register non-prioritized user first (gets the spot)
                await ctx.utils.createPendingRegistration(
                    event.id,
                    nonPrioritizedUser.id,
                );

                // Run resolver
                await resolveRegistrationsForEvent(event.id, ctx);

                // Verify non-prioritized user has the spot
                const nonPriorityReg1 =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (reg, { and, eq }) =>
                            and(
                                eq(reg.eventId, event.id),
                                eq(reg.userId, nonPrioritizedUser.id),
                            ),
                    });
                expect(nonPriorityReg1?.status).toBe("registered");

                // Wait a moment
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Now prioritized user registers (should swap)
                await ctx.utils.createPendingRegistration(
                    event.id,
                    prioritizedUser.id,
                );

                // Run resolver again
                await resolveRegistrationsForEvent(event.id, ctx);

                // Check prioritized user got the spot
                const priorityReg =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (reg, { and, eq }) =>
                            and(
                                eq(reg.eventId, event.id),
                                eq(reg.userId, prioritizedUser.id),
                            ),
                    });
                expect(priorityReg?.status).toBe("registered");

                // Check non-prioritized user was moved to waitlist
                const nonPriorityReg2 =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (reg, { and, eq }) =>
                            and(
                                eq(reg.eventId, event.id),
                                eq(reg.userId, nonPrioritizedUser.id),
                            ),
                    });
                expect(nonPriorityReg2?.status).toBe("waitlisted");
            },
            500_000,
        );

        integrationTest(
            "User must belong to ALL groups in a pool to be prioritized",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                await ctx.utils.setupGroups();

                const event = await ctx.utils.createTestEvent({ capacity: 1 });

                // Create priority pool requiring BOTH "index" AND "drift" groups
                const [pool] = await ctx.db
                    .insert(schema.eventPriorityPool)
                    .values({ eventId: event.id, priorityScore: 1 })
                    .returning();

                if (!pool) {
                    throw new Error("Failed to create priority pool");
                }

                await ctx.db.insert(schema.eventPriorityPoolGroup).values([
                    { priorityPoolId: pool.id, groupSlug: "index" },
                    { priorityPoolId: pool.id, groupSlug: "drift" },
                ]);

                // Create user with only "index" membership (not both)
                const partialUser = await ctx.utils.createTestUser();
                await ctx.db.insert(schema.groupMembership).values({
                    userId: partialUser.id,
                    groupSlug: "index",
                    role: "member",
                });

                // Create non-prioritized user who registers first
                const firstUserData = await ctx.auth.api.createUser({
                    body: {
                        email: "first@test.com",
                        name: "First User",
                        password: "test123!",
                    },
                });
                await ctx.utils.createPendingRegistration(
                    event.id,
                    firstUserData.user.id,
                );

                await resolveRegistrationsForEvent(event.id, ctx);

                // Wait
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Partial user tries to register (should NOT swap)
                await ctx.utils.createPendingRegistration(
                    event.id,
                    partialUser.id,
                );

                await resolveRegistrationsForEvent(event.id, ctx);

                // Partial user should be waitlisted (not prioritized)
                const partialReg =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (reg, { and, eq }) =>
                            and(
                                eq(reg.eventId, event.id),
                                eq(reg.userId, partialUser.id),
                            ),
                    });
                expect(partialReg?.status).toBe("waitlisted");
            },
            500_000,
        );
    });

    describe("Strike System", () => {
        integrationTest(
            "User with 1 strike blocked for 3 hours after registration start",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const now = Date.now();
                const event = await ctx.utils.createTestEvent({
                    registrationStart: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
                    enforcesPreviousStrikes: true,
                });

                const user = await ctx.utils.createTestUser();

                // Give user 1 strike
                await ctx.db.insert(schema.eventStrike).values({
                    eventId: event.id,
                    userId: user.id,
                    count: 1,
                    reason: "Test strike",
                });

                // Create pending registration
                await ctx.utils.createPendingRegistration(event.id, user.id);

                // Run resolver
                await resolveRegistrationsForEvent(event.id, ctx);

                // User should be cancelled (blocked due to strike restriction)
                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(eq(reg.eventId, event.id), eq(reg.userId, user.id)),
                });
                expect(reg?.status).toBe("cancelled");
            },
            500_000,
        );

        integrationTest(
            "User with 1 strike can register after 3 hours",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const now = Date.now();
                const event = await ctx.utils.createTestEvent({
                    registrationStart: new Date(now - 4 * 60 * 60 * 1000), // 4 hours ago
                    enforcesPreviousStrikes: true,
                });

                const user = await ctx.utils.createTestUser();

                // Give user 1 strike
                await ctx.db.insert(schema.eventStrike).values({
                    eventId: event.id,
                    userId: user.id,
                    count: 1,
                    reason: "Test strike",
                });

                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);

                // User should be allowed (4 hours > 3 hours)
                const reg = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(eq(reg.eventId, event.id), eq(reg.userId, user.id)),
                });
                expect(reg?.status).toBe("registered");
            },
            500_000,
        );

        integrationTest(
            "User with 3+ strikes cannot be prioritized when enforcesPreviousStrikes=true",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                await ctx.utils.setupGroups();

                const now = Date.now();
                const event = await ctx.utils.createTestEvent({
                    capacity: 1,
                    enforcesPreviousStrikes: true,
                    // Make registration start 13 hours ago so 3-strike timing passes
                    registrationStart: new Date(now - 13 * 60 * 60 * 1000),
                });

                // Create priority pool
                const [pool] = await ctx.db
                    .insert(schema.eventPriorityPool)
                    .values({ eventId: event.id, priorityScore: 1 })
                    .returning();

                if (!pool) {
                    throw new Error("Failed to create priority pool");
                }

                await ctx.db.insert(schema.eventPriorityPoolGroup).values({
                    priorityPoolId: pool.id,
                    groupSlug: "index",
                });

                // Non-prioritized user gets the spot
                const firstUser = await ctx.utils.createTestUser();
                await ctx.utils.createPendingRegistration(
                    event.id,
                    firstUser.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                // User with 3 strikes who is in priority pool
                const strikedUserData = await ctx.auth.api.createUser({
                    body: {
                        email: "striked@test.com",
                        name: "Striked User",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: strikedUserData.user.id,
                    groupSlug: "index",
                    role: "member",
                });
                await ctx.db.insert(schema.eventStrike).values({
                    eventId: event.id,
                    userId: strikedUserData.user.id,
                    count: 3,
                    reason: "Too many strikes",
                });

                await ctx.utils.createPendingRegistration(
                    event.id,
                    strikedUserData.user.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                // Striked user should NOT swap (despite being in priority pool)
                const strikedReg =
                    await ctx.db.query.eventRegistration.findFirst({
                        where: (reg, { and, eq }) =>
                            and(
                                eq(reg.eventId, event.id),
                                eq(reg.userId, strikedUserData.user.id),
                            ),
                    });
                expect(strikedReg?.status).toBe("waitlisted");
            },
            500_000,
        );
    });

    describe("Waitlist Position Calculation", () => {
        integrationTest(
            "Prioritized waitlist users ordered before non-prioritized",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();
                await ctx.utils.setupGroups();

                const event = await ctx.utils.createTestEvent({ capacity: 1 });

                // Create priority pool
                const [pool] = await ctx.db
                    .insert(schema.eventPriorityPool)
                    .values({ eventId: event.id, priorityScore: 1 })
                    .returning();

                if (!pool) {
                    throw new Error("Failed to create priority pool");
                }

                await ctx.db.insert(schema.eventPriorityPoolGroup).values({
                    priorityPoolId: pool.id,
                    groupSlug: "index",
                });

                // User 1: prioritized, gets the spot
                const user1Data = await ctx.auth.api.createUser({
                    body: {
                        email: "user1@test.com",
                        name: "User 1",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user1Data.user.id,
                    groupSlug: "index",
                    role: "member",
                });
                await ctx.utils.createPendingRegistration(
                    event.id,
                    user1Data.user.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // User 2: non-prioritized, waitlisted
                const user2Data = await ctx.auth.api.createUser({
                    body: {
                        email: "user2@test.com",
                        name: "User 2",
                        password: "test123!",
                    },
                });
                await ctx.utils.createPendingRegistration(
                    event.id,
                    user2Data.user.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // User 3: prioritized, waitlisted
                const user3Data = await ctx.auth.api.createUser({
                    body: {
                        email: "user3@test.com",
                        name: "User 3",
                        password: "test123!",
                    },
                });
                await ctx.db.insert(schema.groupMembership).values({
                    userId: user3Data.user.id,
                    groupSlug: "index",
                    role: "member",
                });
                await ctx.utils.createPendingRegistration(
                    event.id,
                    user3Data.user.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                await new Promise((resolve) => setTimeout(resolve, 10));

                // User 4: non-prioritized, waitlisted
                const user4Data = await ctx.auth.api.createUser({
                    body: {
                        email: "user4@test.com",
                        name: "User 4",
                        password: "test123!",
                    },
                });
                await ctx.utils.createPendingRegistration(
                    event.id,
                    user4Data.user.id,
                );
                await resolveRegistrationsForEvent(event.id, ctx);

                // Check positions: prioritized users should be ahead
                const reg2 = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(
                            eq(reg.eventId, event.id),
                            eq(reg.userId, user2Data.user.id),
                        ),
                });
                const reg3 = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(
                            eq(reg.eventId, event.id),
                            eq(reg.userId, user3Data.user.id),
                        ),
                });
                const reg4 = await ctx.db.query.eventRegistration.findFirst({
                    where: (reg, { and, eq }) =>
                        and(
                            eq(reg.eventId, event.id),
                            eq(reg.userId, user4Data.user.id),
                        ),
                });

                expect(reg3?.waitlistPosition).toBe(1); // Prioritized user first
                expect(reg2?.waitlistPosition).toBe(2); // Non-prioritized second
                expect(reg4?.waitlistPosition).toBe(3); // Non-prioritized third
            },
            500_000,
        );
    });

    describe("Edge Cases", () => {
        integrationTest(
            "Handles event with no pending registrations gracefully",
            async ({ ctx }) => {
                await ctx.utils.setupEventCategories();

                const event = await ctx.utils.createTestEvent();

                // Run resolver with no pending registrations
                await resolveRegistrationsForEvent(event.id, ctx);

                // Should complete without error
                const registrations =
                    await ctx.db.query.eventRegistration.findMany({
                        where: (reg, { eq }) => eq(reg.eventId, event.id),
                    });
                expect(registrations).toHaveLength(0);
            },
            500_000,
        );
    });
});
