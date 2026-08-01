import {
    type JournalMigration,
    findOutOfOrderMigrations,
    findSkippedMigrations,
} from "@photon/db/migration-journal";
import { describe, expect, it } from "vitest";

function migration(tag: string, when: number, idx: number): JournalMigration {
    return { idx, tag, when, hash: `hash-${tag}` };
}

/**
 * These two guards exist because Drizzle picks migrations by journal timestamp
 * rather than index, and silently skips anything not newer than the newest one
 * already applied — while still reporting success. The fixtures below are the
 * real 2026-08-01 incident: 0039 was generated before 0038 but merged after it,
 * so it never ran and `org_group.logo_url` was missing in production.
 */
const ZEROED_38 = migration("0038_lonely_the_hand", 1785578436273, 38);
const ZEROED_39 = migration("0039_exotic_human_fly", 1785506586548, 39);

describe("findOutOfOrderMigrations", () => {
    it("accepts a journal whose timestamps increase with the index", () => {
        const journal = [
            migration("0001_a", 100, 1),
            migration("0002_b", 200, 2),
            migration("0003_c", 300, 3),
        ];

        expect(findOutOfOrderMigrations(journal)).toEqual([]);
    });

    it("flags a migration merged out of timestamp order", () => {
        const outOfOrder = findOutOfOrderMigrations([ZEROED_38, ZEROED_39]);

        expect(outOfOrder).toHaveLength(1);
        expect(outOfOrder[0]?.migration.tag).toBe("0039_exotic_human_fly");
        expect(outOfOrder[0]?.blockedBy.tag).toBe("0038_lonely_the_hand");
    });

    it("compares against the newest timestamp so far, not the previous entry", () => {
        const journal = [
            migration("0001_a", 300, 1),
            migration("0002_b", 100, 2),
            // Newer than 0002 but still shadowed by 0001, so Drizzle skips it.
            migration("0003_c", 200, 3),
        ];

        expect(
            findOutOfOrderMigrations(journal).map((it) => it.migration.tag),
        ).toEqual(["0002_b", "0003_c"]);
    });

    it("flags a duplicate timestamp, which Drizzle also skips", () => {
        const journal = [
            migration("0001_a", 100, 1),
            migration("0002_b", 100, 2),
        ];

        expect(
            findOutOfOrderMigrations(journal).map((it) => it.migration.tag),
        ).toEqual(["0002_b"]);
    });
});

describe("findSkippedMigrations", () => {
    it("returns nothing when every migration reached the ledger", () => {
        const journal = [ZEROED_38, ZEROED_39];
        const applied = journal.map((it) => it.hash);

        expect(findSkippedMigrations(journal, applied)).toEqual([]);
    });

    it("reports a migration missing from the ledger", () => {
        const journal = [ZEROED_38, ZEROED_39];

        const skipped = findSkippedMigrations(journal, [ZEROED_38.hash]);

        expect(skipped.map((it) => it.tag)).toEqual(["0039_exotic_human_fly"]);
    });

    it("ignores ledger rows with no matching journal entry", () => {
        const journal = [ZEROED_38];

        expect(
            findSkippedMigrations(journal, [ZEROED_38.hash, "hash-removed"]),
        ).toEqual([]);
    });
});
