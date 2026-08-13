import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/**
 * Per-connection timeouts, in milliseconds. `0` disables a timeout, which is
 * also Postgres' own default — and the reason tihlde.org was down for an hour
 * on 2026-08-13: a Feide callback sat waiting on a row lock in `auth_account`
 * for 50 minutes, holding one of the pool's connections the whole time. Two
 * more requests queued behind it, and once all connections were held by
 * requests waiting on something that never came, every database-backed route
 * hung. Without a timeout there is nothing that ever breaks such a deadlock.
 *
 * These are deliberately shorter than Bun's 10s `idleTimeout`: a request that
 * blocks this long has already lost its client, so the only thing left to do
 * is give the connection back to the pool.
 */
export type DbTimeouts = {
    /** Max wait for a row/table lock before giving up. */
    lockTimeoutMs?: number;
    /** Max runtime for a single statement. */
    statementTimeoutMs?: number;
    /** Max time a transaction may sit idle before Postgres kills it. */
    idleInTransactionTimeoutMs?: number;
};

/**
 * Defaults for a connection that serves HTTP requests. Long-running work
 * (migrations, bulk imports) must opt out — see `DISABLED_TIMEOUTS`.
 */
export const REQUEST_TIMEOUTS = {
    lockTimeoutMs: 5_000,
    statementTimeoutMs: 15_000,
    idleInTransactionTimeoutMs: 30_000,
} as const satisfies DbTimeouts;

/**
 * No timeouts, for migrations and one-off scripts: an `ALTER TABLE` or a bulk
 * import legitimately runs for minutes, and killing it halfway is worse than
 * letting it finish.
 */
export const DISABLED_TIMEOUTS = {
    lockTimeoutMs: 0,
    statementTimeoutMs: 0,
    idleInTransactionTimeoutMs: 0,
} as const satisfies DbTimeouts;

function buildOptions(timeouts: DbTimeouts): string {
    const {
        lockTimeoutMs = REQUEST_TIMEOUTS.lockTimeoutMs,
        statementTimeoutMs = REQUEST_TIMEOUTS.statementTimeoutMs,
        idleInTransactionTimeoutMs = REQUEST_TIMEOUTS.idleInTransactionTimeoutMs,
    } = timeouts;

    // Passed as libpq start-up options so they apply to every connection the
    // pool opens, including ones created long after startup.
    return [
        `-c lock_timeout=${lockTimeoutMs}`,
        `-c statement_timeout=${statementTimeoutMs}`,
        `-c idle_in_transaction_session_timeout=${idleInTransactionTimeoutMs}`,
    ].join(" ");
}

/**
 * Idle clients in the pool emit `error` when the connection dies under them —
 * a Postgres restart, a network blip, or an admin running
 * `pg_terminate_backend`. Node treats an unhandled `error` event as fatal, so
 * without this listener a single dead connection takes down the whole server.
 * That is exactly what happened during the 2026-08-13 incident: terminating
 * the stuck backends killed the API process and turned a partial outage into a
 * total one.
 *
 * The pool discards the broken client and opens a new one on the next query,
 * so logging is the correct response.
 */
function attachErrorHandler(pool: Pool): Pool {
    pool.on("error", (error) => {
        console.error("Postgres pool error on an idle client:", error);
    });
    return pool;
}

/**
 * Factory function to create a database client.
 * Requires either `connectionString` or `pool`.
 */
export function createDb(config: {
    connectionString?: string;
    pool?: Pool;
    /**
     * Per-connection timeouts. Defaults to {@link REQUEST_TIMEOUTS}; pass
     * {@link DISABLED_TIMEOUTS} for migrations and bulk scripts. Ignored when
     * `pool` is supplied — configure that pool yourself.
     */
    timeouts?: DbTimeouts;
}): NodePgDatabase<typeof schema> {
    const defaultConfig = {
        casing: "snake_case",
        schema,
    } as const;

    const { connectionString, pool, timeouts = {} } = config;

    if (pool) {
        return drizzle({
            client: attachErrorHandler(pool),
            ...defaultConfig,
        });
    }

    if (connectionString) {
        return drizzle({
            client: attachErrorHandler(
                new Pool({
                    connectionString,
                    options: buildOptions(timeouts),
                }),
            ),
            ...defaultConfig,
        });
    }

    throw new Error(
        "createDb requires either a connectionString or pool parameter",
    );
}

export { schema };

/**
 * Database schema type
 */
export type DbSchema = typeof schema;

/**
 * Type of a transaction
 */
export type DbTransaction = Parameters<
    Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
