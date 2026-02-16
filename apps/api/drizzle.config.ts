import { defineConfig } from "drizzle-kit";
import { env } from "~/lib/env";

export default defineConfig({
    out: "./drizzle",
    schema: "../../packages/db/src/schema/*",
    dialect: "postgresql",
    dbCredentials: {
        url: env.DATABASE_URL,
    },
});
