import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { env } from "~/lib/env";
import type { Pool } from "pg";

import * as schema from "./schema";

/**
 * Factory function to create a database client.
 * Can specify `connectionString` or `pool`.
 *
 * Pool takes priority. If none are specified, uses a normal connection using `env.DATABASE_URL`
 */
export function createDb(config?: {
    connectionString?: string;
    pool?: Pool;
}): NodePgDatabase<typeof schema> {
    const defaultConfig = {
        casing: "snake_case",
        schema,
    } as const;

    if (!config || (!config.connectionString && !config.pool)) {
        return drizzle({
            connection: {
                connectionString: env.DATABASE_URL,
            },
            ...defaultConfig,
        });
    }

    const { connectionString, pool } = config;

    if (pool) {
        return drizzle({
            client: pool,
            ...defaultConfig,
        });
    }

    if (connectionString) {
        return drizzle({
            connection: {
                connectionString: connectionString,
            },
            ...defaultConfig,
        });
    }

    throw new Error("THIS SHOULD NOT HAPPEN. Unsound logic above.");
}

/**
 * Default database instance for backward compatibility.
 * Prefer using createDb() and dependency injection in new code.
 */
const db = createDb();

export default db;
export { schema, db };

/**
 * Database schema type
 */
export type DbSchema = typeof schema;

/**
 * Type of a transaction
 */
export type DbTransaction = Parameters<
    Parameters<(typeof db)["transaction"]>[0]
>[0];
