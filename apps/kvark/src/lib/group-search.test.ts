import { describe, expect, test } from "bun:test";
import { groupFineFilters, groupSearchSchema } from "./group-search";

const fineId = "9f3464b3-1ee6-4dd0-8a02-e17a72bff4af";

describe("group search parameters", () => {
    test("keeps existing group links working without a fine ID", () => {
        expect(groupSearchSchema.parse({ tab: "boter" })).toEqual({
            tab: "boter",
            botStatus: "alle",
            botVisning: "alle",
        });
    });

    test.each(["alle", "per-medlem"] as const)(
        "a fine link keeps filters in the %s view",
        (botVisning) => {
            for (const botStatus of [
                "alle",
                "pending",
                "approved",
                "paid",
                "rejected",
            ] as const) {
                expect(
                    groupSearchSchema.parse({
                        tab: "om",
                        botId: fineId,
                        botStatus,
                        botVisning,
                        botBruker: "member-id",
                    }),
                ).toEqual({
                    tab: "boter",
                    botId: fineId,
                    botStatus,
                    botVisning,
                    botBruker: "member-id",
                });
            }
        },
    );

    test("a fine link without filters still selects all fines", () => {
        expect(groupSearchSchema.parse({ botId: fineId })).toEqual({
            tab: "boter",
            botId: fineId,
            botStatus: "alle",
            botVisning: "alle",
        });
    });

    test("maps the per-member default to active fines, not all statuses", () => {
        const search = groupSearchSchema.parse({
            botVisning: "per-medlem",
            botBruker: "member-id",
            botId: fineId,
        });
        expect(groupFineFilters(search)).toEqual({
            status: "active",
            userId: "member-id",
        });
        expect(groupFineFilters({ ...search, botStatus: "paid" })).toEqual({
            status: "paid",
            userId: "member-id",
        });
        expect(groupFineFilters({ ...search, botVisning: "alle" })).toEqual({
            status: undefined,
            userId: "member-id",
        });
        // Former members always use the flat, historical list.
        expect(groupFineFilters(search, true)).toEqual({
            status: undefined,
            userId: "member-id",
        });
    });

    test("ignores malformed fine IDs without breaking the group page", () => {
        for (const botId of ["invalid", "", 123, [fineId]]) {
            expect(groupSearchSchema.parse({ botId }).botId).toBeUndefined();
        }
    });
});
