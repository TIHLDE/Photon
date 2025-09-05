import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config();

export default defineConfig({
    out: "./drizzle",
    schema: "./src/db/schema/*",
    dialect: "postgresql",
    dbCredentials: {
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        url: process.env.DATABASE_URL!,
    },
});
