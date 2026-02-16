import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as schema from "./schema";

/**
 * Factory function to create a database client.
 * Requires `connectionString` or `pool` — no default/env dependency.
 */
export function createDb(
    config: { connectionString: string } | { pool: Pool },
): NodePgDatabase<typeof schema> {
    const defaultConfig = {
        casing: "snake_case",
        schema,
    } as const;

    if ("pool" in config) {
        return drizzle({
            client: config.pool,
            ...defaultConfig,
        });
    }

    return drizzle({
        connection: {
            connectionString: config.connectionString,
        },
        ...defaultConfig,
    });
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
    Parameters<ReturnType<typeof createDb>["transaction"]>[0]
>[0];
