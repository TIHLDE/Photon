import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

const baseEventBody = {
    title: "Field Test Event",
    description: "Event for testing imageAlt and onlyAllowPrioritized",
    categorySlug: "bedpres",
    organizerGroupSlug: "index",
    location: "Trondheim",
    imageUrl: "https://example.com/image.png",
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
    contactPersonUserId: null,
    reactionsAllowed: true,
};

describe("event imageAlt and onlyAllowPrioritized", () => {
    integrationTest(
        "imageAlt is persisted on create and returned on detail and list",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const createResponse = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    imageAlt: "Students at the company presentation",
                },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            expect(detailResponse.status).toBe(200);
            const detail = await detailResponse.json();
            expect(detail).toMatchObject({
                imageAlt: "Students at the company presentation",
                onlyAllowPrioritized: false,
            });

            const listResponse = await client.api.event.$get({ query: {} });
            expect(listResponse.status).toBe(200);
            const list = await listResponse.json();
            const listed = list.items.find((e) => e.id === eventId);
            expect(listed?.imageAlt).toBe(
                "Students at the company presentation",
            );
        },
        500_000,
    );

    integrationTest(
        "imageAlt and onlyAllowPrioritized can be changed on update",
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
                json: { ...baseEventBody, imageAlt: "Old alt text" },
            });
            expect(createResponse.status).toBe(201);
            const { eventId } = await createResponse.json();

            const updateResponse = await client.api.event[":id"].$put({
                param: { id: eventId },
                json: {
                    imageAlt: "New alt text",
                    priorityPools: [{ groupSlug: "index", classYear: null }],
                    onlyAllowPrioritized: true,
                },
            });
            expect(updateResponse.status).toBe(200);

            const detailResponse = await client.api.event[":eventId"].$get({
                param: { eventId },
            });
            const detail = await detailResponse.json();
            expect(detail).toMatchObject({
                imageAlt: "New alt text",
                onlyAllowPrioritized: true,
            });
        },
        500_000,
    );

    integrationTest(
        "onlyAllowPrioritized cannot be enabled without priority pools",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            await ctx.utils.giveUserPermissions(user, ["events:create"]);

            const response = await client.api.event.$post({
                json: {
                    ...baseEventBody,
                    priorityPools: null,
                    onlyAllowPrioritized: true,
                },
            });
            expect(response.status).toBe(400);
        },
        500_000,
    );
});

describe("registration allowPhoto", () => {
    integrationTest(
        "allowPhoto is stored on sign-up and defaults to true without settings",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();

            const decliningUser = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(decliningUser, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(decliningUser.id);
            const decliningClient =
                await ctx.utils.clientForUser(decliningUser);

            const declineResponse = await decliningClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: { allowPhoto: false },
            });
            expect(declineResponse.status).toBe(200);
            const declineJson = await declineResponse.json();
            expect(declineJson.allowPhoto).toBe(false);

            const defaultUser = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(defaultUser, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(defaultUser.id);
            const defaultClient = await ctx.utils.clientForUser(defaultUser);

            const defaultResponse = await defaultClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(defaultResponse.status).toBe(200);
            const defaultJson = await defaultResponse.json();
            expect(defaultJson.allowPhoto).toBe(true);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            const declined = rows.find((r) => r.userId === decliningUser.id);
            const defaulted = rows.find((r) => r.userId === defaultUser.id);
            expect(declined?.allowPhoto).toBe(false);
            expect(defaulted?.allowPhoto).toBe(true);
        },
        500_000,
    );

    integrationTest(
        "allowPhoto falls back to the account-level allowsPhotosByDefault",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();

            const user = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(user, [
                "events:registrations:create",
            ]);
            // Samtykket styres fra profilinnstillingene, ikke per arrangement.
            await ctx.db.insert(schema.userSettings).values({
                userId: user.id,
                gender: "other",
                allowsPhotosByDefault: false,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                isOnboarded: true,
            });
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(response.status).toBe(200);
            const json = await response.json();
            expect(json.allowPhoto).toBe(false);

            const row = await ctx.db.query.eventRegistration.findFirst({
                where: (reg, { and, eq }) =>
                    and(eq(reg.eventId, event.id), eq(reg.userId, user.id)),
            });
            expect(row?.allowPhoto).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "allowPhoto is only exposed in the registration list for event admins",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();

            const attendee = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: attendee.id,
                status: "registered",
                allowPhoto: false,
            });

            const adminUser = await ctx.utils.createTestUser();
            const adminClient = await ctx.utils.clientForUser(adminUser);
            await ctx.utils.giveUserPermissions(adminUser, ["events:manage"]);

            const adminResponse = await adminClient.api.event[
                ":eventId"
            ].registration.$get({
                param: { eventId: event.id },
                query: {},
            });
            expect(adminResponse.status).toBe(200);
            const adminJson = await adminResponse.json();
            const adminRow = adminJson.registeredUsers.find(
                (u) => u.id === attendee.id,
            );
            expect(adminRow?.allowPhoto).toBe(false);

            const regularUser = await ctx.utils.createTestUser();
            const regularClient = await ctx.utils.clientForUser(regularUser);

            const regularResponse = await regularClient.api.event[
                ":eventId"
            ].registration.$get({
                param: { eventId: event.id },
                query: {},
            });
            expect(regularResponse.status).toBe(200);
            const regularJson = await regularResponse.json();
            const regularRow = regularJson.registeredUsers.find(
                (u) => u.id === attendee.id,
            );
            expect(regularRow).toBeDefined();
            expect(regularRow?.allowPhoto).toBeUndefined();
        },
        500_000,
    );
});

describe("onlyAllowPrioritized sign-up enforcement", () => {
    integrationTest(
        "non-prioritized users are rejected and pool members accepted",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                onlyAllowPrioritized: true,
                enforcesPreviousStrikes: false,
            });

            await ctx.db.insert(schema.eventPriorityPool).values({
                eventId: event.id,
                groupSlug: "index",
                classYear: null,
            });

            const outsider = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(outsider, [
                "events:registrations:create",
            ]);
            // Accepted, so the 403 below can only come from the priority pool.
            await ctx.utils.acceptEventRules(outsider.id);
            const outsiderClient = await ctx.utils.clientForUser(outsider);

            const outsiderResponse = await outsiderClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(outsiderResponse.status).toBe(403);

            const member = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(member, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(member.id);
            await ctx.db.insert(schema.groupMembership).values({
                userId: member.id,
                groupSlug: "index",
                role: "member",
            });
            const memberClient = await ctx.utils.clientForUser(member);

            const memberResponse = await memberClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(memberResponse.status).toBe(200);
        },
        500_000,
    );
});
