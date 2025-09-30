import { z } from "zod";
import { config } from "@dotenvx/dotenvx";
config({
    path: "../../.env",
});

const toBoolean =
    ({ defaultVal }: { defaultVal: boolean }) =>
    (val: string | undefined) => {
        if (!val) {
            return defaultVal;
        }

        return val.toLowerCase() === "true" || val === "1";
    };

const envSchema = z
    .object({
        // CONFIG
        ROOT_URL: z
            .string()
            .meta({ description: "Base URL of the application" })
            .default("http://localhost:4000"),
        PORT: z
            .string()
            .meta({ description: "Port to run the server on" })
            .default("4000")
            .transform((val) => Number(val)),
        WEBHOOK_URL: z.string().optional().default("").meta({
            description:
                "The URL to use to send webhook requests to Photon. May be different if using NGROK or similar when developing locally. Otherwise, will default to the same value as ROOT_URL",
        }),

        // DATABASE
        DATABASE_URL: z.string().meta({ description: "Database URL" }),
        SEED_DB: z
            .string()
            .meta({
                description:
                    "If the database is empty on start, will seed the database. Turned off by default",
            })
            .optional()
            .transform(toBoolean({ defaultVal: false })),
        REDIS_URL: z
            .string()
            .meta({ description: "Redis connection URL" })
            .default("redis://localhost:6379"),

        // FEIDE
        FEIDE_CLIENT_ID: z
            .string()
            .meta({ description: "Feide OAuth Client ID" }),
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
        REFRESH_VIPPS_WEBHOOKS: z
            .string()
            .meta({
                description:
                    "Whether to ensure Vipps webhooks are always valid by fetching against the API. This should be TRUE in production or while testing this specifically, but should NOT BE TRUE for local development, since it polls the API everytime the server is restarted; can cause rate limiting.",
            })
            .optional()
            .transform(toBoolean({ defaultVal: false })),
        VIPPS_TEST_MODE: z
            .string()
            .meta({
                description:
                    "If true, sends requests to Vipps' test server instead of production. Useful for local development.",
            })
            .optional()
            .transform(toBoolean({ defaultVal: false })),
    })
    .transform((vals) => {
        // Webhook URL defaults to ROOT_URL if not defined
        if (!vals.WEBHOOK_URL) {
            return {
                ...vals,
                WEBHOOK_URL: vals.ROOT_URL,
            };
        }

        console.warn(`🪝 Using custom webhook URL: ${vals.WEBHOOK_URL}`);
        return vals;
    });

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 */
export const env = envSchema.parse(process.env);
