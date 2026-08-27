import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { resolveRegistrationsForEvent } from "~/lib/event/resolve-registration";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * Prisen var det eneste feltet der «ikke nevnt» betød «nullstill». En delvis
 * oppdatering — et skript som bare hevet kapasiteten, for eksempel — gjorde
 * dermed et betalt arrangement gratis for alle som meldte seg på etterpå, helt
 * uten varsel. Kvark sender hele skjemaet og slapp unna; API-et gjorde ikke.
 */
async function priceOf(ctx: IntegrationTestContext, eventId: string) {
    const row = await ctx.db.query.event.findFirst({
        where: (e, { eq }) => eq(e.id, eventId),
        columns: { priceMinor: true, isPaidEvent: true },
    });
    return row;
}

describe("update keeps the price it was not asked to change", () => {
    integrationTest(
        "a partial update that never mentions the price leaves it alone",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            const event = await ctx.utils.createTestEvent({
                slug: `pris-beholdes-${Date.now()}`,
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            for (const json of [
                { capacity: 20 },
                { title: "Nytt navn" },
                { description: "Ny tekst" },
            ]) {
                const response = await client.api.event[":id"].$put({
                    param: { id: event.id },
                    json,
                });
                expect(response.status).toBe(200);
                expect(await priceOf(ctx, event.id)).toEqual({
                    isPaidEvent: true,
                    priceMinor: 51000,
                });
            }
        },
        500_000,
    );

    integrationTest(
        "an explicit price is still written, and null still clears it",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            const event = await ctx.utils.createTestEvent({
                slug: `pris-endres-${Date.now()}`,
                capacity: 10,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            // Kroner inn, øre lagret.
            await client.api.event[":id"].$put({
                param: { id: event.id },
                json: { price: 250 },
            });
            expect((await priceOf(ctx, event.id))?.priceMinor).toBe(25000);

            // Å skru av betaling fjerner prisen, selv uten at den nevnes.
            await client.api.event[":id"].$put({
                param: { id: event.id },
                json: { isPaidEvent: false },
            });
            expect(await priceOf(ctx, event.id)).toEqual({
                isPaidEvent: false,
                priceMinor: null,
            });
        },
        500_000,
    );

    integrationTest(
        "raising the capacity on a paid event still charges the promoted",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const organizer = await ctx.utils.createTestUser();
            await ctx.utils.giveUserPermissions(organizer, ["events:update"]);
            const client = await ctx.utils.clientForUser(organizer);

            const event = await ctx.utils.createTestEvent({
                slug: `pris-opprykk-${Date.now()}`,
                capacity: 1,
                isPaidEvent: true,
                priceMinor: 51000,
            });

            const holder = await ctx.utils.createTestUser();
            const waiting = await ctx.utils.createTestUser();

            for (const user of [holder, waiting]) {
                await ctx.utils.giveUserPermissions(user, [
                    "events:registrations:create",
                ]);
                await ctx.utils.acceptEventRules(user.id);
                await ctx.utils.createPendingRegistration(event.id, user.id);
                await resolveRegistrationsForEvent(event.id, ctx);
                await new Promise((r) => setTimeout(r, 10));
            }

            // Nøyaktig kallet et skript ville gjort: bare kapasiteten.
            const response = await client.api.event[":id"].$put({
                param: { id: event.id },
                json: { capacity: 2 },
            });
            expect(response.status).toBe(200);

            const payments = await ctx.db
                .select()
                .from(schema.eventPayment)
                .where(
                    and(
                        eq(schema.eventPayment.eventId, event.id),
                        eq(schema.eventPayment.userId, waiting.id),
                    ),
                );

            // Plassen kom med et krav — ikke gratis.
            expect(payments).toHaveLength(1);
            expect(payments[0]?.amountMinor).toBe(51000);
        },
        500_000,
    );
});
