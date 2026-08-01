import { env } from "@photon/core/env";
import { createDb } from "@photon/db";
import {
    findSkippedMigrations,
    readMigrationJournal,
} from "@photon/db/migration-journal";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * Applies pending Drizzle migrations, then exits.
 *
 * This runs as its own step ahead of the server (see the ENTRYPOINT in
 * `infra/docker/Dockerfile`) rather than from inside the app, so a failed
 * migration aborts the boot instead of leaving the API serving requests against
 * a schema it no longer matches. Deploys only ship a new image — nothing in the
 * pipeline migrates for us, so the app owns this.
 *
 * The folder matches where the Dockerfile copies `packages/db/drizzle`. Local
 * development syncs the schema with `bun run db:push` instead and never runs
 * this.
 */
const MIGRATIONS_FOLDER = "./drizzle";

/**
 * Fails when a migration in the journal never reached the database.
 *
 * `migrate()` picks what to run by comparing each migration's journal timestamp
 * against the single newest `created_at` already in the ledger, and skips
 * anything older *without saying so* — it still resolves successfully. A
 * migration generated on one branch but merged after a newer one is therefore
 * passed over in silence.
 *
 * That is how `0039_exotic_human_fly` never reached production on 2026-08-01:
 * it was generated before `0038_lonely_the_hand` but merged after it, so
 * migrate() reported success, the API booted, and every query touching
 * `org_group` failed on the missing `logo_url` column. Comparing the whole
 * ledger against the journal turns that silent skip into an aborted boot, which
 * is what the ENTRYPOINT already assumes happens.
 */
async function assertNoMigrationsSkipped(
    db: ReturnType<typeof createDb>,
): Promise<void> {
    const journal = readMigrationJournal(MIGRATIONS_FOLDER);
    const applied = await db.execute<{ hash: string }>(
        sql`select hash from drizzle.__drizzle_migrations`,
    );

    const skipped = findSkippedMigrations(
        journal,
        applied.rows.map((row) => row.hash),
    );

    if (skipped.length === 0) {
        return;
    }

    const names = skipped.map((migration) => migration.tag).join(", ");

    throw new Error(
        `${skipped.length} migration(s) were silently skipped and are missing from the database: ${names}. ` +
            "This happens when a migration's journal timestamp is older than one that already ran. " +
            "Apply the SQL manually in a transaction and insert its ledger row " +
            "(hash = sha256 of the .sql file, created_at = its `when` from meta/_journal.json).",
    );
}

console.log(`Applying database migrations from ${MIGRATIONS_FOLDER}`);

try {
    const db = createDb({ connectionString: env.DATABASE_URL });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await assertNoMigrationsSkipped(db);
    console.log("Database migrations applied");
    process.exit(0);
} catch (error) {
    console.error("Database migration failed — aborting startup", error);
    process.exit(1);
}
