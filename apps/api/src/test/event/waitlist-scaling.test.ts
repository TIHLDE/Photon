import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import {
    calculateWaitlistPosition,
    calculateWaitlistPositions,
} from "~/lib/event/priority";
import { integrationTest } from "~/test/config/integration";
import type { IntegrationTestContext } from "~/test/config/integration";

/**
 * Ventelisteberegningen spurte databasen to ganger per ventelistet for å svare
 * for én av dem — og resolveren kalte den én gang per ventelistet, altså
 * `n × (1 + 2n)` spørringer inne i en transaksjon som holdt `FOR UPDATE`-låser.
 * Med 200 på venteliste ble det titusenvis.
 *
 * Testen teller faktiske spørringer i stedet for å måle tid: tid varierer med
 * maskinen, antall spørringer er en egenskap ved koden.
 *
 * Merk at telleren bare ser spørringer utenfor en transaksjon — PGlite kjører
 * transaksjoner gjennom et eget objekt. Derfor måles funksjonene direkte, ikke
 * gjennom resolveren.
 */
function countQueries(ctx: IntegrationTestContext) {
    const pglite = (
        ctx as unknown as { _pglite: { query: (...a: never[]) => unknown } }
    )._pglite;
    const original = pglite.query.bind(pglite);
    let count = 0;

    pglite.query = ((...args: never[]) => {
        count++;
        return original(...args);
    }) as typeof pglite.query;

    return {
        get count() {
            return count;
        },
        restore() {
            pglite.query = original as typeof pglite.query;
        },
    };
}

const WAITLIST_SIZE = 25;

describe("waitlist position calculation scales linearly", () => {
    integrationTest(
        "positions for a 25-person waitlist cost a handful of queries, not hundreds",
        async ({ ctx }) => {
            await ctx.utils.setupGroups();
            await ctx.utils.setupEventCategories();

            const event = await ctx.utils.createTestEvent({
                slug: `skalering-${Date.now()}`,
                capacity: 1,
            });

            const userIds: string[] = [];
            for (let i = 0; i < WAITLIST_SIZE; i++) {
                const user = await ctx.utils.createTestUser();
                userIds.push(user.id);
            }

            await ctx.db.insert(schema.eventRegistration).values(
                userIds.map((userId, index) => ({
                    eventId: event.id,
                    userId,
                    status: "waitlisted" as const,
                    createdAt: new Date(Date.now() + index),
                })),
            );

            // Slik resolveren gjorde det: én posisjon om gangen, for alle.
            const perUser = countQueries(ctx);
            let positions: number[] = [];
            try {
                for (const userId of userIds) {
                    positions.push(
                        await calculateWaitlistPosition(
                            userId,
                            event.id,
                            { pools: [], priorityUsers: [] },
                            false,
                            ctx.db,
                        ),
                    );
                }
            } finally {
                perUser.restore();
            }

            // Før: 25 × (1 + 2×25) = 1275 spørringer. Nå: 3 per kall.
            expect(perUser.count).toBeLessThan(150);
            expect(new Set(positions).size).toBe(WAITLIST_SIZE);

            // Og hele lista på én gang koster en håndfull uansett størrelse.
            const batched = countQueries(ctx);
            try {
                const all = await calculateWaitlistPositions(
                    event.id,
                    { pools: [], priorityUsers: [] },
                    false,
                    ctx.db,
                );
                expect(all.size).toBe(WAITLIST_SIZE);
            } finally {
                batched.restore();
            }

            expect(batched.count).toBeLessThanOrEqual(6);
        },
        500_000,
    );
});
