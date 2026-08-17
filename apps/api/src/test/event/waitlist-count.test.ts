import { describe, expect } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";

/**
 * Køen bak et fullt arrangement er offentlig av samme grunn som antall
 * påmeldte: hvor lang den er avgjør om det er verdt å melde seg på i det hele
 * tatt. Hvem som står i den er den fortsatt ikke.
 */
describe("event detail reports the waitlist length", () => {
    integrationTest(
        "waitlistCount counts the queue, registeredCount only the spots",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `venteliste-${Date.now()}`,
                capacity: 1,
            });

            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            for (const user of [first, second]) {
                await ctx.utils.giveUserPermissions(user, [
                    "events:registrations:create",
                ]);
                await ctx.utils.acceptEventRules(user.id);
                const client = await ctx.utils.clientForUser(user);
                const response = await client.api.event[
                    ":eventId"
                ].registration.$post({
                    param: { eventId: event.id },
                    json: {},
                });
                expect(response.status).toBe(200);
            }

            await resolveRegistrationsForEvent(event.id, ctx);

            const client = await ctx.utils.clientForUser(first);
            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(detailResponse.status).toBe(200);
            const detail = await detailResponse.json();

            expect(detail).toMatchObject({
                capacity: 1,
                registeredCount: 1,
                waitlistCount: 1,
            });
        },
        500_000,
    );

    integrationTest(
        "an event with room to spare has an empty waitlist",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `ledig-${Date.now()}`,
                capacity: 10,
            });

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(user.id);
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(response.status).toBe(200);

            await resolveRegistrationsForEvent(event.id, ctx);

            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(detailResponse.status).toBe(200);
            const detail = await detailResponse.json();

            expect(detail).toMatchObject({
                registeredCount: 1,
                waitlistCount: 0,
            });
        },
        500_000,
    );
});
