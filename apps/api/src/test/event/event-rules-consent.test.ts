import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

describe("event rules consent", () => {
    integrationTest(
        "rejects registration from a user who has not accepted the event rules",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();

            // A brand new member: signed up, permitted to register, but has
            // never answered the event rules question.
            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });

            expect(response.status).toBe(403);
            const json = (await response.json()) as unknown as {
                message: string;
            };
            expect(json.message).toBe(
                "You must accept the event rules before registering for events",
            );

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "lets the same user register right after accepting from the notice",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            const client = await ctx.utils.clientForUser(user);

            // Exactly what the checkbox in the frontend notice sends — no
            // settings row exists yet, so this also covers the upsert.
            const acceptResponse = await client.api.user.me.settings.$patch({
                json: { acceptsEventRules: true },
            });
            expect(acceptResponse.status).toBe(200);

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
        "rejects a user who explicitly declined the event rules",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            const client = await ctx.utils.clientForUser(user);

            await client.api.user.me.settings.$post({
                json: {
                    gender: "other",
                    allowsPhotosByDefault: false,
                    acceptsEventRules: false,
                    receiveMailCommunication: true,
                    allergies: [],
                },
            });

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
});
