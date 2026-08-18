import { describe, expect } from "vitest";
import {
    type IntegrationTestContext,
    integrationTest,
} from "~/test/config/integration";

const baseEventBody = {
    title: "Priority Pool Event",
    description: "Event for testing priority pool validation",
    categorySlug: "bedpres",
    organizerGroupSlug: "index",
    location: "Trondheim",
    imageUrl: "https://example.com/image.png",
    imageAlt: null,
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
    canCauseStrikes: false,
    enforcesPreviousStrikes: false,
    isPaidEvent: false,
    price: null,
    contactPersonUserId: null,
    reactionsAllowed: true,
};

/** Signs in an admin who may create events for any group. */
async function adminClient(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    await ctx.utils.setupGroups();
    await ctx.utils.setupEventCategories();
    await ctx.utils.giveUserPermissions(user, [
        "events:create",
        "events:update",
    ]);
    return await ctx.utils.clientForUser(user);
}

describe("priority pool validation", () => {
    integrationTest(
        "rejects a pool that sets no criterion at all",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            // Without this the event would look prioritized while matching
            // nobody — and with onlyAllowPrioritized it would be unjoinable.
            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [{ groupSlug: null, classYear: null }],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects an unknown group slug with 400, not a foreign-key 500",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [
                        { groupSlug: "does-not-exist", classYear: null },
                    ],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects duplicate pools",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [
                        { groupSlug: "index", classYear: null },
                        { groupSlug: "index", classYear: null },
                    ],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects an interest group that is not the organizer",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            // Index arranging an event may not prioritize Basket's members.
            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [{ groupSlug: "basket", classYear: null }],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "accepts an interest group prioritizing itself on its own event",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    organizerGroupSlug: "basket",
                    priorityPools: [{ groupSlug: "basket", classYear: null }],
                },
            });

            expect(response.status).toBe(201);
        },
        500_000,
    );

    integrationTest(
        "rejects the organizer's own interest group combined with a class level",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    organizerGroupSlug: "basket",
                    priorityPools: [{ groupSlug: "basket", classYear: 1 }],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects a class level above 3 without the master study",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            // There is no bare "4. klasse": only the master reaches it.
            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [{ groupSlug: null, classYear: 4 }],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects a bachelor study combined with class level 4",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [{ groupSlug: "dataingenir", classYear: 4 }],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects the master study without a class level",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            // The master exists in the picker only as 4. and 5. klasse, so a
            // bare entry would silently mean both.
            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [
                        { groupSlug: "digital-samhandling", classYear: null },
                    ],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "rejects a non-study group combined with a class level",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: [{ groupSlug: "index", classYear: 1 }],
                },
            });

            expect(response.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "accepts class levels, studies and the master combination, and round-trips them",
        async ({ ctx }) => {
            const client = await adminClient(ctx);

            const pools = [
                { groupSlug: null, classYear: 1 },
                { groupSlug: "dataingenir", classYear: 2 },
                { groupSlug: "digital-samhandling", classYear: 4 },
                { groupSlug: "index", classYear: null },
            ];

            const createResponse = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: pools,
                    onlyAllowPrioritized: true,
                },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            // Narrowed so the body is the event and not the 404 union arm.
            if (detailResponse.status !== 200) {
                throw new Error("Expected the event to be found");
            }
            const detail = await detailResponse.json();

            expect(
                detail.priorityPools
                    .map((pool) => ({
                        groupSlug: pool.group?.slug ?? null,
                        classYear: pool.classYear,
                    }))
                    .sort((a, b) =>
                        `${a.groupSlug}${a.classYear}`.localeCompare(
                            `${b.groupSlug}${b.classYear}`,
                        ),
                    ),
            ).toEqual(
                [...pools].sort((a, b) =>
                    `${a.groupSlug}${a.classYear}`.localeCompare(
                        `${b.groupSlug}${b.classYear}`,
                    ),
                ),
            );

            // The editor sends back exactly what it was given, so saving an
            // untouched event must be a no-op rather than a 400.
            const updateResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { priorityPools: pools, onlyAllowPrioritized: true },
            });
            expect(updateResponse.status).toBe(200);
        },
        500_000,
    );
});
