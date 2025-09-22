import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "~/lib/env";

import * as schema from "./schema";

const db = drizzle({
    connection: {
        connectionString: env.DATABASE_URL,
    },
    casing: "snake_case",
    schema,
});

export default db;
export { schema, db };

export type DbSchema = typeof schema;
export type DbTransaction = Parameters<
    Parameters<(typeof db)["transaction"]>[0]
>[0];
