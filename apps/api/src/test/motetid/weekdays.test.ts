import { schema } from "@photon/db";
import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * A Møtetid board is either date-based (find one day for a one-off activity)
 * or weekday-based (find a fixed weekly slot). Both share the same string
 * columns, so what needs guarding is that the two modes never mix.
 */
describe("Møtetid weekday boards", () => {
    integrationTest(
        "Weekday board: create, sort Monday-first, and collect availability",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const created = await client.api.motetid.events.$post({
                json: {
                    title: "Fast ukesmøte",
                    dateMode: "WEEKDAYS",
                    // Deliberately out of order: weekdays must not be sorted
                    // lexicographically, which would put Friday before Monday.
                    dates: ["FRI", "MON", "WED"],
                    startTime: "10:00",
                    endTime: "12:00",
                },
            });

            expect(created.status).toBe(201);
            const { slug } = await created.json();

            const saved = await client.api.motetid.events[
                ":slug"
            ].availability.$put({
                param: { slug },
                json: {
                    name: "Tester",
                    slots: [
                        {
                            date: "MON",
                            time: "10:00",
                            status: "AVAILABLE" as const,
                        },
                        {
                            date: "WED",
                            time: "11:30",
                            status: "IF_NEEDED" as const,
                        },
                    ],
                },
            });
            expect(saved.status).toBe(200);

            const fetched = await client.api.motetid.events[":slug"].$get({
                param: { slug },
            });
            expect(fetched.status).toBe(200);
            const board = await fetched.json();

            expect(board.dateMode).toBe("WEEKDAYS");
            expect(board.dates).toEqual(["MON", "WED", "FRI"]);
            expect(board.participants[0]?.slots).toHaveLength(2);
        },
    );

    integrationTest(
        "Omitting dateMode keeps the board date-based",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const created = await client.api.motetid.events.$post({
                json: {
                    title: "Engangsaktivitet",
                    dates: ["2026-08-20", "2026-08-18"],
                    startTime: "09:00",
                    endTime: "10:00",
                },
            });
            expect(created.status).toBe(201);
            const { slug } = await created.json();

            const board = await (
                await client.api.motetid.events[":slug"].$get({
                    param: { slug },
                })
            ).json();

            expect(board.dateMode).toBe("DATES");
            expect(board.dates).toEqual(["2026-08-18", "2026-08-20"]);
        },
    );

    integrationTest("Columns must match the board's mode", async ({ ctx }) => {
        const user = await ctx.utils.createTestUser();
        const client = await ctx.utils.clientForUser(user);

        const weekdayKeysOnDateBoard = await client.api.motetid.events.$post({
            json: {
                title: "Feil modus",
                dateMode: "DATES",
                dates: ["MON"],
                startTime: "09:00",
                endTime: "10:00",
            },
        });
        expect(weekdayKeysOnDateBoard.status).toBe(400);

        const datesOnWeekdayBoard = await client.api.motetid.events.$post({
            json: {
                title: "Feil modus",
                dateMode: "WEEKDAYS",
                dates: ["2026-08-20"],
                startTime: "09:00",
                endTime: "10:00",
            },
        });
        expect(datesOnWeekdayBoard.status).toBe(400);

        const duplicates = await client.api.motetid.events.$post({
            json: {
                title: "Duplikat",
                dateMode: "WEEKDAYS",
                dates: ["MON", "MON"],
                startTime: "09:00",
                endTime: "10:00",
            },
        });
        expect(duplicates.status).toBe(400);
    });

    integrationTest(
        "Availability outside the board's columns is rejected",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            const { slug } = await (
                await client.api.motetid.events.$post({
                    json: {
                        title: "Fast ukesmøte",
                        dateMode: "WEEKDAYS",
                        dates: ["MON"],
                        startTime: "10:00",
                        endTime: "11:00",
                    },
                })
            ).json();

            const wrongColumn = await client.api.motetid.events[
                ":slug"
            ].availability.$put({
                param: { slug },
                json: {
                    name: "Tester",
                    slots: [
                        {
                            date: "2026-08-05",
                            time: "10:00",
                            status: "AVAILABLE" as const,
                        },
                    ],
                },
            });
            expect(wrongColumn.status).toBe(400);

            const unlistedWeekday = await client.api.motetid.events[
                ":slug"
            ].availability.$put({
                param: { slug },
                json: {
                    name: "Tester",
                    slots: [
                        {
                            date: "TUE",
                            time: "10:00",
                            status: "AVAILABLE" as const,
                        },
                    ],
                },
            });
            expect(unlistedWeekday.status).toBe(400);
        },
    );

    integrationTest(
        "Calendar sync returns nothing for a weekday board",
        async ({ ctx }) => {
            const user = await ctx.utils.createTestUser();
            const client = await ctx.utils.clientForUser(user);

            // A credential must exist to get past the token check; the weekday
            // guard has to short-circuit before any call to Google, so the
            // bogus token is never used.
            await ctx.db.insert(schema.motetidGoogleCredential).values({
                userId: user.id,
                accessToken: "not-a-real-token",
            });

            const { slug } = await (
                await client.api.motetid.events.$post({
                    json: {
                        title: "Fast ukesmøte",
                        dateMode: "WEEKDAYS",
                        dates: ["MON", "WED"],
                        startTime: "10:00",
                        endTime: "11:00",
                    },
                })
            ).json();

            const synced = await client.api.motetid.events[":slug"][
                "sync-calendar"
            ].$post({ param: { slug } });

            expect(synced.status).toBe(200);
            expect(await synced.json()).toEqual({ blocked: [], events: [] });
        },
    );
});
