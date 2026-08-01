import {
    findOutOfOrderMigrations,
    readMigrationJournal,
} from "../src/migration-journal";

/**
 * Fails when a migration's journal timestamp is not newer than every migration
 * before it.
 *
 * Drizzle decides what to apply by comparing a migration's `when` against the
 * newest `created_at` already in `drizzle.__drizzle_migrations` — never against
 * the index. Anything not strictly newer is skipped in silence, and migrate()
 * still reports success. Ordering the journal by time is therefore the property
 * that actually makes migrations run.
 *
 * The hazard is created at merge time, not generate time: a migration cut from
 * an older branch keeps its original timestamp, so merging it after a
 * newer-but-lower-numbered one leaves it permanently unapplied. Catching that
 * here blocks the PR instead of the deploy.
 *
 * Regenerate the migration (`bun run db:generate`) so it picks up a current
 * timestamp, or raise its `when` in `meta/_journal.json` above every entry
 * before it — but only if it has not already run anywhere, otherwise it will be
 * re-applied against databases that already have it.
 */
const MIGRATIONS_FOLDER = new URL("../drizzle", import.meta.url).pathname;

/**
 * Inversions that predate this check and are already reconciled by hand.
 *
 * `0039_exotic_human_fly` was generated on 2026-07-31 but merged after
 * `0038_lonely_the_hand` (generated 2026-08-01), so it was skipped on every
 * deploy and `org_group.logo_url` never existed in production — new.tihlde.org
 * returned HTTP 500 on everything joining groups until it was applied manually
 * on 2026-08-01. Its timestamp is deliberately left alone: production's ledger
 * row records the original `when`, and raising it would make Drizzle re-apply a
 * migration that has already run. Nothing should ever be added to this list.
 */
const KNOWN_INVERSIONS = new Set(["0039_exotic_human_fly"]);

const journal = readMigrationJournal(MIGRATIONS_FOLDER);
const inversions = findOutOfOrderMigrations(journal).filter(
    ({ migration }) => !KNOWN_INVERSIONS.has(migration.tag),
);

if (inversions.length > 0) {
    const details = inversions
        .map(
            ({ migration, blockedBy }) =>
                `  ${migration.tag} (when=${migration.when}) is not newer than ${blockedBy.tag} (when=${blockedBy.when})`,
        )
        .join("\n");

    console.error(
        `${inversions.length} migration(s) would be silently skipped by Drizzle:\n${details}\n\n` +
            "Drizzle applies a migration only when its journal `when` is newer than every migration\n" +
            "already recorded in the database, so these would never run. Regenerate them with\n" +
            "`bun run db:generate` so they get a current timestamp.",
    );
    process.exit(1);
}

console.log(
    `Migration journal is correctly ordered (${journal.length} entries)`,
);
