import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A single entry from `drizzle/meta/_journal.json`, paired with the hash
 * Drizzle records for it in `drizzle.__drizzle_migrations`.
 */
export type JournalMigration = {
    idx: number;
    tag: string;
    /**
     * Millisecond timestamp from the journal. Drizzle calls this `folderMillis`
     * and uses it — not the index — to decide what still needs applying.
     */
    when: number;
    /** sha256 of the `.sql` file, matching `readMigrationFiles` in drizzle-orm. */
    hash: string;
};

type JournalFile = {
    entries: Array<{ idx: number; tag: string; when: number }>;
};

/**
 * Reads the migration journal and hashes each migration exactly the way
 * drizzle-orm does, so the results can be compared against the rows in
 * `drizzle.__drizzle_migrations`.
 */
export function readMigrationJournal(
    migrationsFolder: string,
): JournalMigration[] {
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    const journal = JSON.parse(
        readFileSync(journalPath, "utf8"),
    ) as JournalFile;

    return journal.entries.map((entry) => {
        const sql = readFileSync(
            join(migrationsFolder, `${entry.tag}.sql`),
            "utf8",
        );

        return {
            idx: entry.idx,
            tag: entry.tag,
            when: entry.when,
            hash: createHash("sha256").update(sql).digest("hex"),
        };
    });
}

/**
 * Returns the journal migrations that are absent from Drizzle's ledger.
 *
 * A non-empty result means `migrate()` skipped them without reporting it: it
 * only runs migrations whose `when` is newer than the single newest
 * `created_at` already recorded, so one merged out of timestamp order is passed
 * over for good while migrate() still resolves successfully.
 */
export function findSkippedMigrations(
    journal: JournalMigration[],
    appliedHashes: Iterable<string>,
): JournalMigration[] {
    const applied = new Set(appliedHashes);

    return journal.filter((migration) => !applied.has(migration.hash));
}

/** A migration Drizzle will never run, and the one whose timestamp shadows it. */
export type OutOfOrderMigration = {
    migration: JournalMigration;
    blockedBy: JournalMigration;
};

/**
 * Returns migrations whose `when` is not newer than every migration before
 * them, which is precisely the set Drizzle will skip once the earlier ones have
 * been applied.
 *
 * Compares against the newest timestamp seen so far rather than the previous
 * entry, mirroring how Drizzle compares against `max(created_at)` in the
 * ledger.
 */
export function findOutOfOrderMigrations(
    journal: JournalMigration[],
): OutOfOrderMigration[] {
    const outOfOrder: OutOfOrderMigration[] = [];
    let newest: JournalMigration | undefined;

    for (const migration of journal) {
        if (newest && migration.when <= newest.when) {
            outOfOrder.push({ migration, blockedBy: newest });
            continue;
        }

        newest = migration;
    }

    return outOfOrder;
}
