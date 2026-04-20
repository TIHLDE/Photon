/**
 * Lepton → Photon Migration Script
 *
 * Migrates data from old Django/MySQL backend to new Hono/TypeScript/PostgreSQL backend.
 *
 * Usage:
 *   bun src/index.ts --mysql-url="mysql://root:pass@localhost:3306/lepton" [options]
 *
 * Options:
 *   --mysql-url   MySQL connection URL (required, or set MYSQL_URL env)
 *   --phase       Run only a specific phase (e.g. --phase=users)
 *   --force       Truncate target tables before inserting
 *   --verify-only Run only verification (no migration)
 */
import { createDb } from "@photon/db";
import { createAuth } from "@photon/auth";
import { env } from "@photon/core/env";
import { QueueManager, createRedisClient } from "@photon/core/cache";
import { createEmailTransporter } from "@photon/email";
import { connectMySQL, closeMySQL } from "./mysql";
import { skippedUsers, userIdMap, eventIdMap, newsIdMap } from "./mappings";

import { migrateUsers } from "./phases/01-users";
import { migrateGroups } from "./phases/02-groups";
import { migrateCategories } from "./phases/03-categories";
import { migrateEvents } from "./phases/04-events";
import { migrateRegistrations } from "./phases/05-registrations";
import { migrateStrikes } from "./phases/06-strikes";
import { migratePayments } from "./phases/07-payments";
import { migratePriorityPools } from "./phases/08-priority-pools";
import { migrateFavorites } from "./phases/09-favorites";
import { migrateForms } from "./phases/10-forms";
import { migrateNews } from "./phases/11-news";
import { migrateReactions } from "./phases/12-reactions";
import { migrateJobs } from "./phases/13-jobs";
import { migrateNotifications } from "./phases/14-notifications";
import { verify } from "./verify";

function parseArgs(): {
    mysqlUrl: string;
    phase: string | null;
    force: boolean;
    verifyOnly: boolean;
} {
    const args = process.argv.slice(2);
    let mysqlUrl = process.env.MYSQL_URL ?? "";
    let phase: string | null = null;
    let force = false;
    let verifyOnly = false;

    for (const arg of args) {
        if (arg.startsWith("--mysql-url=")) {
            mysqlUrl = arg.slice("--mysql-url=".length);
        } else if (arg.startsWith("--phase=")) {
            phase = arg.slice("--phase=".length);
        } else if (arg === "--force") {
            force = true;
        } else if (arg === "--verify-only") {
            verifyOnly = true;
        }
    }

    if (!mysqlUrl) {
        console.error("ERROR: --mysql-url or MYSQL_URL env var is required");
        process.exit(1);
    }

    return { mysqlUrl, phase, force, verifyOnly };
}

import type { AuthInstance } from "./types";

const PHASE_MAP: Record<
    string,
    (
        db: Parameters<typeof migrateUsers>[0],
        auth: AuthInstance,
    ) => Promise<void>
> = {
    users: (db, auth) => migrateUsers(db, auth),
    groups: (db) => migrateGroups(db),
    categories: (db) => migrateCategories(db),
    events: (db) => migrateEvents(db),
    registrations: (db) => migrateRegistrations(db),
    strikes: (db) => migrateStrikes(db),
    payments: (db) => migratePayments(db),
    "priority-pools": (db) => migratePriorityPools(db),
    favorites: (db) => migrateFavorites(db),
    forms: (db) => migrateForms(db),
    news: (db) => migrateNews(db),
    reactions: (db) => migrateReactions(db),
    jobs: (db) => migrateJobs(db),
    notifications: (db) => migrateNotifications(db),
};

async function main() {
    const { mysqlUrl, phase, force, verifyOnly } = parseArgs();

    console.log("🚀 Lepton → Photon Migration");
    console.log(
        `  PostgreSQL: ${env.DATABASE_URL.replace(/:[^@]+@/, ":***@")}`,
    );
    console.log(`  MySQL: ${mysqlUrl.replace(/:[^@]+@/, ":***@")}`);
    if (phase) console.log(`  Phase: ${phase}`);
    if (force) console.log(`  Force mode: ON`);
    console.log();

    // Connect to databases
    const db = createDb({ connectionString: env.DATABASE_URL });
    await connectMySQL(mysqlUrl);

    if (verifyOnly) {
        await verify(db);
        await closeMySQL();
        return;
    }

    // Create auth instance for user migration
    const redis = await createRedisClient(env.REDIS_URL);
    const queue = new QueueManager(env.REDIS_URL);
    const mailer = createEmailTransporter();
    const auth = createAuth({ db, redis, mailer, queue, bucket: null as any });

    const startTime = Date.now();

    if (phase) {
        const phaseFn = PHASE_MAP[phase];
        if (!phaseFn) {
            console.error(`Unknown phase: ${phase}`);
            console.error(`Available: ${Object.keys(PHASE_MAP).join(", ")}`);
            process.exit(1);
        }
        await phaseFn(db, auth);
    } else {
        // Run all phases in order
        await migrateUsers(db, auth);
        await migrateGroups(db);
        await migrateCategories(db);
        await migrateEvents(db);
        await migrateRegistrations(db);
        await migrateStrikes(db);
        await migratePayments(db);
        await migratePriorityPools(db);
        await migrateFavorites(db);
        await migrateForms(db);
        await migrateNews(db);
        await migrateReactions(db);
        await migrateJobs(db);
        await migrateNotifications(db);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Migration completed in ${elapsed}s`);
    console.log(`  Users migrated: ${userIdMap.size}`);
    console.log(`  Users skipped: ${skippedUsers.size}`);
    console.log(`  Events migrated: ${eventIdMap.size}`);
    console.log(`  News migrated: ${newsIdMap.size}`);

    // Run verification
    await verify(db);

    await closeMySQL();
    process.exit(0);
}

main().catch((err) => {
    console.error("💥 Migration failed:", err);
    process.exit(1);
});
