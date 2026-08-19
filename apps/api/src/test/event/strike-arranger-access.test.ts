import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Prikker follow the arrangement.
 *
 * Whoever may edit a group's arrangementer handles the prikker they produce —
 * no separate `events:strikes:*` needed. It stays narrow: the grant is scoped
 * to a group, so it reaches that group's own events and nobody else's.
 */
describe("prikker follow the event's arrangør", () => {
    integrationTest(
        "a group leader without events:strikes:* may give and remove prikker on their own group's event",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const target = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const group = await ctx.utils.createTestGroup({
                slug: "arrangorgruppa",
            });
            // Exactly what NoK's leader holds in production: the event
            // permissions, and no strike permission anywhere.
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["events:update", "events:create"] })
                .where(eq(schema.group.slug, group.slug));
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: group.slug,
                role: "leader",
            });

            const event = await ctx.utils.createTestEvent({
                organizerGroupSlug: group.slug,
            });

            const created = await client.api.event.strikes.$post({
                json: {
                    userId: target.id,
                    eventId: event.id,
                    count: 1,
                    reason: "Møtte ikke opp",
                },
            });
            expect(created.status).toBe(201);
            const strike = await created.json();

            const removed = await client.api.event.strikes[":strikeId"].$delete(
                { param: { strikeId: strike.id } },
            );
            expect(removed.status).toBe(200);
        },
        500_000,
    );

    integrationTest(
        "the same leader may not touch another group's event",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const target = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const own = await ctx.utils.createTestGroup({
                slug: "egen-gruppe",
            });
            const other = await ctx.utils.createTestGroup({
                slug: "annen-gruppe",
            });
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["events:update", "events:create"] })
                .where(eq(schema.group.slug, own.slug));
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: own.slug,
                role: "leader",
            });

            const foreignEvent = await ctx.utils.createTestEvent({
                organizerGroupSlug: other.slug,
            });

            const created = await client.api.event.strikes.$post({
                json: {
                    userId: target.id,
                    eventId: foreignEvent.id,
                    count: 1,
                    reason: "Ikke min gruppe",
                },
            });
            expect(created.status).toBe(403);
        },
        500_000,
    );

    integrationTest(
        "the prikkeliste shows the arrangør only their own group's prikker",
        async ({ ctx }) => {
            const leader = await ctx.utils.createTestUser();
            const target = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(leader);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const own = await ctx.utils.createTestGroup({ slug: "min-gruppe" });
            const other = await ctx.utils.createTestGroup({
                slug: "andres-gruppe",
            });
            await ctx.db
                .update(schema.group)
                .set({ leaderPermissions: ["events:update"] })
                .where(eq(schema.group.slug, own.slug));
            await ctx.db.insert(schema.groupMembership).values({
                userId: leader.id,
                groupSlug: own.slug,
                role: "leader",
            });

            const ownEvent = await ctx.utils.createTestEvent({
                organizerGroupSlug: own.slug,
            });
            const otherEvent = await ctx.utils.createTestEvent({
                slug: `annet-arrangement-${Date.now()}`,
                organizerGroupSlug: other.slug,
            });

            await ctx.db.insert(schema.eventStrike).values([
                { userId: target.id, eventId: ownEvent.id, count: 1 },
                { userId: target.id, eventId: otherEvent.id, count: 1 },
            ]);

            const listed = await client.api.event.strikes.$get({ query: {} });
            expect(listed.status).toBe(200);
            const body = await listed.json();

            expect(body.strikes.map((s) => s.eventId)).toEqual([ownEvent.id]);
            expect(body.totalCount).toBe(1);
        },
        500_000,
    );

    integrationTest(
        "a global events:strikes:view still sees every group's prikker (non-regression)",
        async ({ ctx }) => {
            const admin = await ctx.utils.createTestUser();
            const target = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:strikes:view"]);
            const client = await ctx.utils.clientForUser(admin);

            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const one = await ctx.utils.createTestGroup({ slug: "gruppe-en" });
            const two = await ctx.utils.createTestGroup({ slug: "gruppe-to" });

            const eventOne = await ctx.utils.createTestEvent({
                organizerGroupSlug: one.slug,
            });
            const eventTwo = await ctx.utils.createTestEvent({
                slug: `arrangement-to-${Date.now()}`,
                organizerGroupSlug: two.slug,
            });

            await ctx.db.insert(schema.eventStrike).values([
                { userId: target.id, eventId: eventOne.id, count: 1 },
                { userId: target.id, eventId: eventTwo.id, count: 1 },
            ]);

            const listed = await client.api.event.strikes.$get({ query: {} });
            expect(listed.status).toBe(200);
            const body = await listed.json();
            expect(body.totalCount).toBe(2);
        },
        500_000,
    );
});
