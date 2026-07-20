import { env } from "@photon/core/env";
import { createDb } from "@photon/db";
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

console.log(`Applying database migrations from ${MIGRATIONS_FOLDER}`);

try {
    const db = createDb({ connectionString: env.DATABASE_URL });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Database migrations applied");
    process.exit(0);
} catch (error) {
    console.error("Database migration failed — aborting startup", error);
    process.exit(1);
}
