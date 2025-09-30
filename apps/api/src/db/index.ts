import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";

import { env } from "~/lib/env";

import * as schema from "./schema";

/**
 * Factory function to create a database client.
 * Use this for dependency injection and testing.
 */
export function createDb(
    connectionString: string,
): NodePgDatabase<typeof schema> {
    return drizzle({
        connection: {
            connectionString,
        },
        casing: "snake_case",
        schema,
    });
}

/**
 * Default database instance for backward compatibility.
 * Prefer using createDb() and dependency injection in new code.
 */
const db = createDb(env.DATABASE_URL);

export default db;
export { schema, db };

export type DbSchema = typeof schema;
export type DbTransaction = Parameters<
    Parameters<(typeof db)["transaction"]>[0]
>[0];
