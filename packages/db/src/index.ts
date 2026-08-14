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
    /**
     * Max wait for a free connection from the pool. The per-connection
     * timeouts above bound what one query may do; this bounds the queue that
     * forms in front of them. Without it a saturated pool makes every new
     * request wait indefinitely — which is what turned three stuck requests
     * into a site-wide outage.
     */
    connectionTimeoutMs?: number;
};

/**
 * Defaults for a connection that serves HTTP requests. Long-running work
 * (migrations, bulk imports) must opt out — see `DISABLED_TIMEOUTS`.
 */
export const REQUEST_TIMEOUTS = {
    lockTimeoutMs: 5_000,
    statementTimeoutMs: 15_000,
    idleInTransactionTimeoutMs: 30_000,
    connectionTimeoutMs: 5_000,
} as const satisfies DbTimeouts;

/**
 * Connections the API pool may open. `pg` defaults to 10, which is thin for
 * what this API actually gets asked to do: when registration opens for a
 * popular event, 200–300 members hit it at once — the record is 29 sign-ups
 * inside a single second, 156 inside a minute — and each sign-up makes up to
 * nine round-trips before it is done.
 *
 * Room to grow into, not a number to max out: Postgres allows 100 connections
 * in total and that budget is shared with every other service on the host
 * (Grafana included, which is why a wedged database takes the dashboards down
 * with it). Twenty-five leaves plenty for the neighbours.
 */
const POOL_MAX = 25;

/**
 * No timeouts, for migrations and one-off scripts: an `ALTER TABLE` or a bulk
 * import legitimately runs for minutes, and killing it halfway is worse than
 * letting it finish. A script that starves its own pool should wait rather
 * than fail, so the connection wait is unbounded here too.
 */
export const DISABLED_TIMEOUTS = {
    lockTimeoutMs: 0,
    statementTimeoutMs: 0,
    idleInTransactionTimeoutMs: 0,
    connectionTimeoutMs: 0,
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

/** How often the pool is sampled for saturation. */
const SATURATION_SAMPLE_MS = 2_000;

/** How often an ongoing saturation is repeated in the log. */
const SATURATION_REPEAT_MS = 30_000;

/**
 * How long the pool must stay saturated before it is worth a word.
 *
 * The first version of this warned on the very first saturated sample, and
 * production answered within a day: 15 episodes in 26 hours, every one of them
 * "recovered after 2s". That is a busy moment, not an incident — requests
 * queueing briefly is exactly what a pool is for, and the queue drained faster
 * than anyone could notice. It cost 26 alert e-mails and taught us nothing.
 *
 * The outage this watchdog exists for lasted 40 minutes. Ten seconds is far
 * below anything a user would sit through, and far above normal burst
 * behaviour.
 */
const SATURATION_MIN_MS = 10_000;

/**
 * Warn while every connection is checked out and requests are queueing.
 *
 * The 2026-08-13 outage was a saturated pool, and nothing said so. The logs
 * showed healthy traffic, then silence — because a request that never
 * finishes never logs. From the outside it looked like a dead server, and it
 * cost an hour to work out that ten connections were held by requests waiting
 * on a lock. One line saying "all 10 connections busy, 14 requests waiting"
 * would have pointed straight at it.
 *
 * Only fires when the pool is *both* full and has requests queueing, and only
 * once that has held for {@link SATURATION_MIN_MS}: a fully used pool with
 * nobody waiting is a busy server working as intended, and a queue that drains
 * within seconds is the pool doing its job.
 *
 * Recovery is only logged when a warning was actually issued, so the log tells
 * a whole story or stays silent — never just the ending.
 *
 * The interval is unref'd so it can never hold the process open, and the
 * sampling is deliberately cheap — the counters are plain numbers on the pool.
 */
function watchSaturation(pool: Pool): Pool {
    const max = pool.options.max ?? 10;
    let saturatedSince: number | null = null;
    let lastWarnedAt = 0;
    let warned = false;
    let peakWaiting = 0;

    const timer = setInterval(() => {
        const waiting = pool.waitingCount;
        const saturated = waiting > 0 && pool.totalCount >= max;
        const now = Date.now();

        if (saturated) {
            saturatedSince ??= now;
            peakWaiting = Math.max(peakWaiting, waiting);

            const heldFor = now - saturatedSince;
            const due = warned
                ? now - lastWarnedAt >= SATURATION_REPEAT_MS
                : heldFor >= SATURATION_MIN_MS;

            if (due) {
                lastWarnedAt = now;
                warned = true;
                console.warn(
                    `Postgres pool saturated: all ${max} connections busy, ${waiting} request(s) queueing, ` +
                        `${Math.round(heldFor / 1000)}s so far. ` +
                        "Something is holding connections open — look for long-running queries and lock waits.",
                );
            }
            return;
        }

        if (saturatedSince !== null) {
            if (warned) {
                console.warn(
                    `Postgres pool recovered after ${Math.round((now - saturatedSince) / 1000)}s, ` +
                        `peak queue ${peakWaiting} request(s).`,
                );
            }
            saturatedSince = null;
            lastWarnedAt = 0;
            warned = false;
            peakWaiting = 0;
        }
    }, SATURATION_SAMPLE_MS);

    timer.unref?.();
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
            client: watchSaturation(attachErrorHandler(pool)),
            ...defaultConfig,
        });
    }

    if (connectionString) {
        const { connectionTimeoutMs = REQUEST_TIMEOUTS.connectionTimeoutMs } =
            timeouts;

        return drizzle({
            client: watchSaturation(
                attachErrorHandler(
                    new Pool({
                        connectionString,
                        options: buildOptions(timeouts),
                        connectionTimeoutMillis: connectionTimeoutMs,
                        max: POOL_MAX,
                    }),
                ),
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
