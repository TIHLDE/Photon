import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

const HOUR = 60 * 60 * 1000;

/**
 * The admin add-registration route exists so an organizer can force-add
 * people — themselves or a co-organizer — to an event whose registration
 * window has not opened yet. It skips the checks that gate a member's own
 * sign-up, but it does not hand out spots ahead of the queue: the resolver
 * decides capacity and waitlist exactly as for a normal sign-up.
 */
async function organizer(ctx: IntegrationTestContext) {
    const user = await ctx.utils.createTestUser();
    await ctx.utils.giveUserPermissions(user, ["events:update"]);
    return { user, client: await ctx.utils.clientForUser(user) };
}

describe("Admin add registration", () => {
    integrationTest(
        "adds a user before registration has opened",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                registrationStart: new Date(now + 48 * HOUR),
                registrationEnd: new Date(now + 72 * HOUR),
                start: new Date(now + 96 * HOUR),
                end: new Date(now + 100 * HOUR),
            });
            const guest = await ctx.utils.createTestUser();

            const { client } = await organizer(ctx);
            const res = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: guest.id },
                json: {},
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.status).toBe("pending");
            expect(body.userId).toBe(guest.id);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(1);
            expect(rows[0]?.status).toBe("pending");
            expect(rows[0]?.userId).toBe(guest.id);
            await resolveRegistrationsForEvent(event.id, ctx);
            expect((await registration(ctx, event.id, guest.id))?.status).toBe(
                "registered",
            );
        },
        500_000,
    );

    integrationTest(
        "refuses a member without the event permission",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const now = Date.now();
            const event = await ctx.utils.createTestEvent({
                registrationStart: new Date(now + 48 * HOUR),
                registrationEnd: new Date(now + 72 * HOUR),
                start: new Date(now + 96 * HOUR),
                end: new Date(now + 100 * HOUR),
            });
            const guest = await ctx.utils.createTestUser();

            const caller = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(caller);
            const res = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: guest.id },
                json: {},
            });

            expect(res.status).toBe(403);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );

    integrationTest(
        "refuses a user who already holds a spot",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent();
            const guest = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: guest.id,
                status: "registered",
            });

            const { client } = await organizer(ctx);
            const res = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: guest.id },
                json: {},
            });

            expect(res.status).toBe(409);
        },
        500_000,
    );

    integrationTest(
        "refuses events that do not require sign-up",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                requiresSigningUp: false,
                registrationStart: null,
                registrationEnd: null,
                capacity: null,
            });
            const guest = await ctx.utils.createTestUser();

            const { client } = await organizer(ctx);
            const res = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: guest.id },
                json: {},
            });

            expect(res.status).toBe(409);

            const rows = await ctx.db.query.eventRegistration.findMany({
                where: (reg, { eq }) => eq(reg.eventId, event.id),
            });
            expect(rows).toHaveLength(0);
        },
        500_000,
    );
});

function registration(
    ctx: IntegrationTestContext,
    eventId: string,
    userId: string,
) {
    return ctx.db.query.eventRegistration.findFirst({
        where: (reg, { and, eq }) =>
            and(eq(reg.eventId, eventId), eq(reg.userId, userId)),
    });
}

describe("Organizer registration resolution", () => {
    for (const scenario of ["closed", "strikes", "full", "paid"] as const) {
        integrationTest(
            `resolves an organizer addition when ${scenario}`,
            async ({ ctx }) => {
                await ctx.utils.setupGroups();
                await ctx.utils.setupEventCategories();
                const event = await ctx.utils.createTestEvent({
                    registrationStart: new Date(Date.now() + 48 * HOUR),
                    registrationEnd: new Date(Date.now() + 72 * HOUR),
                    isRegistrationClosed: scenario === "closed",
                    capacity: scenario === "full" ? 1 : 10,
                    isPaidEvent: scenario === "paid",
                    priceMinor: scenario === "paid" ? 10000 : null,
                });
                const guest = await ctx.utils.createTestUser();
                const ordinary = await ctx.utils.createTestUser();
                if (scenario === "strikes") {
                    for (const user of [guest, ordinary]) {
                        await ctx.db.insert(schema.eventStrike).values({
                            eventId: event.id,
                            userId: user.id,
                            count: 1,
                            reason: "Test strike",
                        });
                    }
                }
                await ctx.db.insert(schema.eventRegistration).values({
                    eventId: event.id,
                    userId: ordinary.id,
                    status: scenario === "full" ? "registered" : "pending",
                });
                const { client } = await organizer(ctx);
                const res = await client.api.event[":eventId"].registration[
                    ":userId"
                ].$post({
                    param: { eventId: event.id, userId: guest.id },
                    json: {},
                });
                expect(res.status).toBe(200);
                await resolveRegistrationsForEvent(event.id, ctx);
                expect(
                    (await registration(ctx, event.id, guest.id))?.status,
                ).toBe(scenario === "full" ? "waitlisted" : "registered");
                if (scenario === "closed" || scenario === "strikes") {
                    expect(
                        (await registration(ctx, event.id, ordinary.id))
                            ?.status,
                    ).toBe("cancelled");
                }
                if (scenario === "paid") {
                    const payment = await ctx.db.query.eventPayment.findFirst({
                        where: (p, { and, eq }) =>
                            and(
                                eq(p.eventId, event.id),
                                eq(p.userId, guest.id),
                            ),
                    });
                    expect(payment?.amountMinor).toBe(10000);
                }
            },
        );
    }

    integrationTest("returns 404 for a missing user", async ({ ctx }) => {
        await ctx.utils.setupGroups();
        await ctx.utils.setupEventCategories();
        const event = await ctx.utils.createTestEvent();
        const { client } = await organizer(ctx);
        const res = await client.api.event[":eventId"].registration[
            ":userId"
        ].$post({
            param: { eventId: event.id, userId: "missing-user" },
            json: {},
        });
        expect(res.status).toBe(404);
    });

    integrationTest(
        "revives cancelled registrations and clears the override on self-registration",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const event = await ctx.utils.createTestEvent();
            const guest = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.eventRegistration).values({
                eventId: event.id,
                userId: guest.id,
                status: "cancelled",
                waitlistPosition: 5,
                attendedAt: new Date(),
            });
            const { client } = await organizer(ctx);
            const res = await client.api.event[":eventId"].registration[
                ":userId"
            ].$post({
                param: { eventId: event.id, userId: guest.id },
                json: { allowPhoto: false },
            });
            expect(res.status).toBe(200);
            expect(await registration(ctx, event.id, guest.id)).toMatchObject({
                addedByOrganizer: true,
                allowPhoto: false,
                waitlistPosition: null,
                attendedAt: null,
            });
            await resolveRegistrationsForEvent(event.id, ctx);
            expect((await registration(ctx, event.id, guest.id))?.status).toBe(
                "registered",
            );
            await ctx.db
                .update(schema.eventRegistration)
                .set({ status: "cancelled" })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, event.id),
                        eq(schema.eventRegistration.userId, guest.id),
                    ),
                );
            await ctx.utils.giveUserPermissions(guest, [
                "events:registrations:create",
            ]);
            await ctx.utils.acceptEventRules(guest.id);
            await ctx.db.insert(schema.eventStrike).values({
                eventId: event.id,
                userId: guest.id,
                count: 1,
                reason: "Test strike",
            });
            const guestClient = await ctx.utils.clientForUser(guest);
            const self = await guestClient.api.event[
                ":eventId"
            ].registration.$post({
                param: { eventId: event.id },
                json: {},
            });
            expect(self.status).toBe(200);
            expect(
                (await registration(ctx, event.id, guest.id))?.addedByOrganizer,
            ).toBe(false);
            await resolveRegistrationsForEvent(event.id, ctx);
            expect((await registration(ctx, event.id, guest.id))?.status).toBe(
                "cancelled",
            );
        },
    );

    integrationTest(
        "limits a group organizer to their own events",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();
            const group = await ctx.utils.createTestGroup({
                slug: "organizer-add-test",
            });
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["events:update"] })
                .where(eq(schema.group.slug, group.slug));
            const leader = await ctx.utils.createTestUser();
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });
            const client = await ctx.utils.clientForUser(leader);
            const guest = await ctx.utils.createTestUser();
            for (const organizerGroupSlug of [group.slug, "index"]) {
                const event = await ctx.utils.createTestEvent({
                    organizerGroupSlug,
                });
                const res = await client.api.event[":eventId"].registration[
                    ":userId"
                ].$post({
                    param: { eventId: event.id, userId: guest.id },
                    json: {},
                });
                expect(res.status).toBe(
                    organizerGroupSlug === group.slug ? 200 : 403,
                );
            }
        },
    );
});
