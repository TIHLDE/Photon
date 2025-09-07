import { z } from "zod";
import { config } from "@dotenvx/dotenvx";
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
    MAIL_HOST: z.string({ description: "MAIL Host" }).optional(),
    MAIL_PORT: z
        .string({ description: "MAIL Port" })
        .default("587")
        .transform((val) => Number(val)),
    MAIL_USER: z.string({ description: "MAIL User" }).optional(),
    MAIL_PASS: z.string({ description: "MAIL Password" }).optional(),
    MAIL_FROM: z
        .string({ description: "MAIL From Email Address" })
        .default("no-reply@tihlde.org"),
    PORT: z
        .string({ description: "Port to run the server on" })
        .default("4000")
        .transform((val) => Number(val)),
});

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 */
export const env = envSchema.parse(process.env);
