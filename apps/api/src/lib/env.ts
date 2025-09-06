import { z } from "zod";
import { config } from "dotenv";
config({ path: "../../.env" });

const envSchema = z.object({
    FEIDE_CLIENT_ID: z.string({ description: "Feide OAuth Client ID" }),
    FEIDE_CLIENT_SECRET: z.string({ description: "Feide OAuth Client Secret" }),
    DATABASE_URL: z.string({ description: "Database URL" }),
    BASE_URL: z
        .string({ description: "Base URL of the application" })
        .default("http://localhost:4000"),
    SEED_DB: z
        .string({
            description:
                "If the database is empty on start, will seed the database. Turned off by default",
        })
        .optional()
        .transform((val) => val === "true" || val === "1"),
});

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 */
export const env = envSchema.parse(process.env);
