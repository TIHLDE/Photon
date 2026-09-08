import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Adminlista grupperer på medlem. Totalen er summen av `count`, ikke antall
 * rader — en enkelt rad kan være verdt to eller tre prikker, og det var
 * nettopp det den flate lista skjulte.
 */
describe("strikes grouped by member", () => {
    integrationTest(
        "summerer prikkene per medlem og sider over medlemmer",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:strikes:view"]);
            const client = await ctx.utils.clientForUser(admin);

            const first = await ctx.utils.createTestEvent({
                slug: `prikk-en-${Date.now()}`,
            });
            const second = await ctx.utils.createTestEvent({
                slug: `prikk-to-${Date.now()}`,
            });

            const many = await ctx.utils.createTestUser();
            const one = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventStrike).values([
                {
                    eventId: first.id,
                    userId: many.id,
                    count: 2,
                    reason: "Møtte ikke opp",
                },
                {
                    eventId: second.id,
                    userId: many.id,
                    count: 1,
                    reason: "Avmelding etter fristen",
                },
                { eventId: first.id, userId: one.id, count: 1, reason: null },
            ]);

            const response = await client.api.event.strikes.members.$get({
                query: {},
            });
            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.totalCount).toBe(2);

            const withMany = body.members.find(
                (member) => member.user.id === many.id,
            );
            expect(withMany?.totalStrikes).toBe(3);
            expect(withMany?.strikes).toHaveLength(2);
            expect(
                withMany?.strikes.map((strike) => strike.event.title),
            ).toHaveLength(2);

            const withOne = body.members.find(
                (member) => member.user.id === one.id,
            );
            expect(withOne?.totalStrikes).toBe(1);

            // Sidene teller medlemmer, så det ene medlemmets tre prikker kan
            // ikke bli delt over to sider og vise feil total.
            const paged = await client.api.event.strikes.members.$get({
                query: { pageSize: "1" },
            });
            const pagedBody = await paged.json();
            expect(pagedBody.pages).toBe(2);
            expect(pagedBody.members).toHaveLength(1);
            expect(pagedBody.members[0]?.totalStrikes).toBe(
                pagedBody.members[0]?.strikes.reduce(
                    (sum, strike) => sum + strike.count,
                    0,
                ),
            );
        },
        500_000,
    );

    integrationTest(
        "utløpte prikker teller ikke med",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:strikes:view"]);
            const client = await ctx.utils.clientForUser(admin);

            const event = await ctx.utils.createTestEvent({
                slug: `prikk-utlopt-${Date.now()}`,
            });
            const user = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventStrike).values([
                {
                    eventId: event.id,
                    userId: user.id,
                    count: 1,
                    reason: null,
                },
            ]);
            await ctx.db.insert(schema.eventStrike).values([
                {
                    eventId: event.id,
                    userId: user.id,
                    count: 3,
                    reason: "Gammel",
                    createdAt: new Date("2020-01-15T12:00:00Z"),
                },
            ]);

            const response = await client.api.event.strikes.members.$get({
                query: {},
            });
            const body = await response.json();

            expect(body.members).toHaveLength(1);
            expect(body.members[0]?.totalStrikes).toBe(1);
            expect(body.members[0]?.strikes).toHaveLength(1);
        },
        500_000,
    );

    integrationTest(
        "to medlemmer med samme tidspunkt havner ikke på samme side to ganger",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const admin = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(admin, ["events:strikes:view"]);
            const client = await ctx.utils.clientForUser(admin);

            const event = await ctx.utils.createTestEvent({
                slug: `prikk-likt-${Date.now()}`,
            });
            const sameMoment = new Date();

            const first = await ctx.utils.createTestUser();
            const second = await ctx.utils.createTestUser();

            await ctx.db.insert(schema.eventStrike).values([
                {
                    eventId: event.id,
                    userId: first.id,
                    count: 1,
                    reason: null,
                    createdAt: sameMoment,
                },
                {
                    eventId: event.id,
                    userId: second.id,
                    count: 1,
                    reason: null,
                    createdAt: sameMoment,
                },
            ]);

            const pageOne = await client.api.event.strikes.members.$get({
                query: { pageSize: "1", page: "0" },
            });
            const pageTwo = await client.api.event.strikes.members.$get({
                query: { pageSize: "1", page: "1" },
            });

            const ids = [
                ...(await pageOne.json()).members,
                ...(await pageTwo.json()).members,
            ].map((member) => member.user.id);

            expect(new Set(ids).size).toBe(2);
        },
        500_000,
    );

    integrationTest(
        "uten tilgang kommer man ikke inn",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const response = await client.api.event.strikes.members.$get({
                query: {},
            });

            expect(response.status).toBe(403);
        },
        500_000,
    );
});
