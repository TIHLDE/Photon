import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as schema from "./schema";

/**
 * Factory function to create a database client.
 * Requires either `connectionString` or `pool`.
 */
export function createDb(config: {
    connectionString?: string;
    pool?: Pool;
}): NodePgDatabase<typeof schema> {
    const defaultConfig = {
        casing: "snake_case",
        schema,
    } as const;

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
