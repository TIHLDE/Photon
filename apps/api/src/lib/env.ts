import { z } from "zod";
import { config } from "@dotenvx/dotenvx";
config({ path: "../../.env" });

const envSchema = z.object({
    // CONFIG
    BASE_URL: z
        .string()
        .meta({ description: "Base URL of the application" })
        .default("http://localhost:4000"),
    PORT: z
        .string()
        .meta({ description: "Port to run the server on" })
        .default("4000")
        .transform((val) => Number(val)),

    // DATABASE
    DATABASE_URL: z.string().meta({ description: "Database URL" }),
    SEED_DB: z
        .string()
        .meta({
            description:
                "If the database is empty on start, will seed the database. Turned off by default",
        })
        .optional()
        .transform((val) => val === "true" || val === "1"),
    REDIS_URL: z
        .string()
        .meta({ description: "Redis connection URL" })
        .default("redis://localhost:6379"),

    // FEIDE
    FEIDE_CLIENT_ID: z.string().meta({ description: "Feide OAuth Client ID" }),
    FEIDE_CLIENT_SECRET: z
        .string()
        .meta({ description: "Feide OAuth Client Secret" }),

    // EMAIL
    MAIL_HOST: z.string().meta({ description: "MAIL Host" }).optional(),
    MAIL_PORT: z
        .string()
        .meta({ description: "MAIL Port" })
        .default("587")
        .transform((val) => Number(val)),
    MAIL_USER: z.string().meta({ description: "MAIL User" }).optional(),
    MAIL_PASS: z.string().meta({ description: "MAIL Password" }).optional(),
    MAIL_FROM: z
        .string()
        .meta({ description: "MAIL From Email Address" })
        .default("no-reply@tihlde.org"),

    // VIPPS
    VIPPS_SUBSCRIPTION_KEY: z
        .string()
        .meta({ description: "Vipps Subscription Key" })
        .optional(),
    VIPPS_CLIENT_ID: z
        .string()
        .meta({ description: "Vipps Client ID" })
        .optional(),
    VIPPS_CLIENT_SECRET: z
        .string()
        .meta({ description: "Vipps Client Secret" })
        .optional(),
    VIPPS_MERCHANT_SERIAL_NUMBER: z
        .string()
        .meta({
            description: "Vipps Merchant Serial Number",
        })
        .optional(),
});

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 */
export const env = envSchema.parse(process.env);
