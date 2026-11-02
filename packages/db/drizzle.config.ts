import { defineConfig } from "drizzle-kit";
import { env } from "@photon/core/env";

export default defineConfig({
    out: "./drizzle",
    schema: "./src/schema/index.ts",
    dialect: "postgresql",
    dbCredentials: {
        url: env.DATABASE_URL,
    },
});
