import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const baseEventBody = {
    title: "Event med kontaktperson",
    description: "Test av kontaktperson på arrangementsdetaljene",
    categorySlug: "bedpres",
    organizerGroupSlug: "index",
    location: "Trondheim",
    imageUrl: null,
    imageAlt: null,
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
    reactionsAllowed: true,
};

describe("event contact person", () => {
    integrationTest(
        "is returned on the event detail, with the e-mail only for authenticated callers",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const createResponse = await client.api.event.$post({
                json: { ...baseEventBody, contactPersonUserId: user.id },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(detailResponse.status).toBe(200);
            const detail = await detailResponse.json();
            expect(detail).toMatchObject({
                contactPerson: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
            });

            // Adressen skal ikke kunne høstes fra de åpne sidene.
            const anonymous = ctx.utils.client();
            const publicResponse = await anonymous.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(publicResponse.status).toBe(200);
            const publicDetail = await publicResponse.json();
            expect(publicDetail).toMatchObject({
                contactPerson: {
                    id: user.id,
                    name: user.name,
                    email: null,
                },
            });
        },
        500_000,
    );

    integrationTest(
        "is null when the event has none",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const createResponse = await client.api.event.$post({
                json: { ...baseEventBody, contactPersonUserId: null },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            const detail = await detailResponse.json();
            expect(detail).toMatchObject({ contactPerson: null });
        },
        500_000,
    );

    integrationTest(
        "can be set and cleared on update",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, [
                "events:create",
                "events:update",
            ]);

            const createResponse = await client.api.event.$post({
                json: { ...baseEventBody, contactPersonUserId: null },
            });
            const { eventId } = await createResponse.json();

            const setResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { contactPersonUserId: user.id },
            });
            expect(setResponse.status).toBe(200);

            const afterSetResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(await afterSetResponse.json()).toMatchObject({
                contactPerson: { id: user.id },
            });

            const clearResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: { contactPersonUserId: null },
            });
            expect(clearResponse.status).toBe(200);

            const afterClearResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(await afterClearResponse.json()).toMatchObject({
                contactPerson: null,
            });
        },
        500_000,
    );
});
