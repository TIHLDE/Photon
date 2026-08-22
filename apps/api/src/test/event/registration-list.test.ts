import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import type { IntegrationTestContext } from "~/test/config/integration";
import { integrationTest } from "~/test/config/integration";

/**
 * Seed an event with one registered user, one waitlisted and one cancelled.
 */
async function seedRegistrations(ctx: IntegrationTestContext) {
    await ctx.utils.setupEventCategories();
    const event = await ctx.utils.createTestEvent({
        isPaidEvent: true,
        priceMinor: 5000,
    });

    const registered = await ctx.utils.createTestUser();
    const waitlisted = await ctx.utils.createTestUser();
    const cancelled = await ctx.utils.createTestUser();

    await ctx.db.insert(schema.eventRegistration).values([
        { eventId: event.id, userId: registered.id, status: "registered" },
        {
            eventId: event.id,
            userId: waitlisted.id,
            status: "waitlisted",
            waitlistPosition: 1,
        },
        { eventId: event.id, userId: cancelled.id, status: "cancelled" },
    ]);

    return { event, registered, waitlisted, cancelled };
}

describe("Event registration listing", () => {
    integrationTest(
        // Regression guard: who attends must not be enumerable from the open
        // internet. The count itself stays public, on the event.
        "refuses anonymous callers, but the event still carries the count",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);

            const client = ctx.utils.client();
            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(res.status).toBe(401);

            const eventRes = await client.api.event[":eventId"].$get({
                param: { eventId: event.id },
            });
            expect(eventRes.status).toBe(200);
            // The 404 branch returns a bare string, so narrow before reading.
            const body = await eventRes.json();
            expect(typeof body).not.toBe("string");
            expect(
                typeof body === "string" ? undefined : body.registeredCount,
            ).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "hides admin fields and non-registered statuses from ordinary members",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);
            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.totalCount).toBe(1);
            const [user] = body.registeredUsers;
            expect(user?.email).toBeUndefined();
            expect(user?.status).toBeUndefined();
            expect(user?.payment).toBeUndefined();
            expect(user?.waitlistPosition).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "hides name, picture and id of members with public registrations off",
        async ({ ctx }) => {
            const { event, registered } = await seedRegistrations(ctx);
            await ctx.db.insert(schema.userSettings).values({
                userId: registered.id,
                gender: "other",
                allowsPhotosByDefault: true,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                publicEventRegistrations: false,
            });

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);
            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            const body = await res.json();
            // The spot is still counted — only the identity is withheld.
            expect(body.totalCount).toBe(1);
            const [user] = body.registeredUsers;
            expect(user?.isAnonymous).toBe(true);
            expect(user?.name).not.toBe(registered.name);
            expect(user?.id).not.toBe(registered.id);
            expect(user?.image).toBeNull();
        },
        500_000,
    );

    integrationTest(
        "still shows the member their own registration, and admins theirs",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);

            const shy = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.userSettings).values({
                userId: shy.id,
                gender: "other",
                allowsPhotosByDefault: true,
                acceptsEventRules: true,
                receiveMailCommunication: true,
                publicEventRegistrations: false,
            });
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: shy.id,
                status: "registered",
            });

            const selfClient = await ctx.utils.clientForUser(shy);
            const selfRes = await selfClient.api.event[
                ":eventId"
            ].registration.$get({
                param: { eventId: event.id },
                query: {},
            });
            const selfBody = await selfRes.json();
            const own = selfBody.registeredUsers.find((u) => u.id === shy.id);
            expect(own?.name).toBe(shy.name);
            expect(own?.isAnonymous).toBe(false);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const adminClient = await ctx.utils.clientForUser(admin);
            const adminRes = await adminClient.api.event[
                ":eventId"
            ].registration.$get({
                param: { eventId: event.id },
                query: {},
            });
            const adminBody = await adminRes.json();
            const seen = adminBody.registeredUsers.find((u) => u.id === shy.id);
            expect(seen?.name).toBe(shy.name);
            expect(seen?.isAnonymous).toBe(false);
        },
        500_000,
    );

    integrationTest(
        "returns the same default set for admins, with admin fields added",
        async ({ ctx }) => {
            const { event, registered } = await seedRegistrations(ctx);
            await ctx.db.insert(schema.eventPayment).values({
                eventId: event.id,
                userId: registered.id,
                amountMinor: 5000,
                currency: "NOK",
                status: "paid",
                providerPaymentId: "ref-1",
            });

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            // Default is unchanged: waitlisted/cancelled are still excluded.
            expect(body.totalCount).toBe(1);

            const [user] = body.registeredUsers;
            expect(user?.email).toBe(registered.email);
            expect(user?.status).toBe("registered");
            expect(user?.registeredAt).toBeDefined();
            expect(user?.payment?.status).toBe("paid");
            expect(user?.payment?.amountMinor).toBe(5000);
        },
        500_000,
    );

    integrationTest(
        "lets admins filter to waitlisted and cancelled registrations",
        async ({ ctx }) => {
            const { event, waitlisted } = await seedRegistrations(ctx);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { status: "waitlisted,cancelled" },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.totalCount).toBe(2);
            const waitlistedRow = body.registeredUsers.find(
                (u) => u.id === waitlisted.id,
            );
            expect(waitlistedRow?.status).toBe("waitlisted");
            expect(waitlistedRow?.waitlistPosition).toBe(1);
        },
        500_000,
    );

    integrationTest(
        // The «Påmeldte»-fanen teller kull og studie fra disse to feltene, og
        // en master skal telles på sitt eget kull — ikke på kullgruppa, som
        // for de fleste bærer året bacheloren startet.
        "serves the member's current programme and cohort to admins",
        async ({ ctx }) => {
            const { event, registered } = await seedRegistrations(ctx);

            await ctx.utils.createTestGroup({
                slug: "digital-forretningsutvikling",
                name: "Digital forretningsutvikling",
                type: "STUDY",
            });
            await ctx.utils.createTestGroup({
                slug: "digital-samhandling",
                name: "Digital transformasjon",
                type: "STUDY",
            });
            await ctx.utils.createTestGroup({
                slug: "2023",
                name: "2023",
                type: "STUDYYEAR",
            });

            const [bachelor] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-forretningsutvikling",
                    feideCode: "ITBAITBEDR",
                    displayName: "Digital Forretningsutvikling",
                    type: "bachelor",
                })
                .returning({ id: schema.studyProgram.id });
            const [master] = await ctx.db
                .insert(schema.studyProgram)
                .values({
                    slug: "digital-samhandling",
                    feideCode: "ITMAIKTSA",
                    displayName: "Digital Samhandling",
                    type: "master",
                })
                .returning({ id: schema.studyProgram.id });

            await ctx.db.insert(schema.groupMembership).values([
                {
                    userId: registered.id,
                    groupSlug: "digital-forretningsutvikling",
                    role: "member",
                },
                {
                    userId: registered.id,
                    groupSlug: "digital-samhandling",
                    role: "member",
                },
                { userId: registered.id, groupSlug: "2023", role: "member" },
            ]);
            await ctx.db.insert(schema.studyProgramMembership).values([
                {
                    userId: registered.id,
                    studyProgramId: bachelor?.id as number,
                    startYear: 2023,
                    startYearSource: "derived",
                    feideActive: false,
                },
                {
                    userId: registered.id,
                    studyProgramId: master?.id as number,
                    startYear: 2026,
                    startYearSource: "derived",
                    feideActive: true,
                },
            ]);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            const row = body.registeredUsers.find(
                (u) => u.id === registered.id,
            );
            expect(row?.studyProgram).toBe("Digital transformasjon");
            expect(row?.studyStartYear).toBe(2026);
        },
        500_000,
    );

    integrationTest(
        // Studie og kull sier like mye om et medlem som e-posten gjør, og
        // hører til samme lås.
        "keeps programme and cohort out of the ordinary member's view",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);
            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            const body = await res.json();
            const [user] = body.registeredUsers;
            expect(user?.studyProgram).toBeUndefined();
            expect(user?.studyStartYear).toBeUndefined();
        },
        500_000,
    );

    integrationTest(
        "rejects status filtering from non-admins",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { status: "waitlisted" },
            });

            expect(res.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "rejects an unknown status",
        async ({ ctx }) => {
            const { event } = await seedRegistrations(ctx);
            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { status: "tullestatus" },
            });

            expect(res.status).toBe(400);
        },
        500_000,
    );

    integrationTest(
        "prefers the paid payment when a user has several rows",
        async ({ ctx }) => {
            const { event, registered } = await seedRegistrations(ctx);
            await ctx.db.insert(schema.eventPayment).values([
                {
                    eventId: event.id,
                    userId: registered.id,
                    amountMinor: 5000,
                    status: "failed",
                    providerPaymentId: "ref-failed",
                },
                {
                    eventId: event.id,
                    userId: registered.id,
                    amountMinor: 5000,
                    status: "paid",
                    providerPaymentId: "ref-paid",
                },
            ]);

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:manage"]);
            const client = await ctx.utils.clientForUser(admin);

            const res = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: {},
            });

            const body = await res.json();
            expect(body.registeredUsers[0]?.payment?.status).toBe("paid");
        },
        500_000,
    );

    integrationTest(
        // Regression guard: pages are 0-based, so the last page must report
        // no next page. It used to point at one page past the end, and the
        // client had to fetch an empty list to discover it was done.
        "reports no next page on the last page",
        async ({ ctx }) => {
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();

            // 3 registrations over pages of 2: pages 0 and 1, nothing after.
            for (let i = 0; i < 3; i++) {
                const user = await ctx.utils.createTestUser();
                await ctx.db.insert(schema.eventRegistration).values({
                    eventId: event.id,
                    userId: user.id,
                    status: "registered",
                });
            }

            const member = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(member);

            const first = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { page: "0", pageSize: "2" },
            });
            const firstBody = await first.json();
            expect(firstBody.totalCount).toBe(3);
            expect(firstBody.registeredUsers).toHaveLength(2);
            expect(firstBody.nextPage).toBe(1);

            const last = await client.api.event[":eventId"].registration.$get({
                param: { eventId: event.id },
                query: { page: "1", pageSize: "2" },
            });
            const lastBody = await last.json();
            expect(lastBody.registeredUsers).toHaveLength(1);
            expect(lastBody.nextPage).toBeNull();
        },
        500_000,
    );
});
