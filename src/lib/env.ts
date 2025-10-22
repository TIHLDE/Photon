import { config } from "@dotenvx/dotenvx";
import { z } from "zod";

if (process.env.NODE_ENV !== "test") {
    config({
        path: ".env",
    });
}

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
        NODE_ENV: z.enum(["production", "development", "test"]),

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
        EMAIL_API_KEY: z
            .string()
            .meta({
                description:
                    "API key for external services to send emails via the API",
            })
            .optional(),

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

type Env = z.infer<typeof envSchema>;

const testEnvVariables: Env = {
    DATABASE_URL: "",
    FEIDE_CLIENT_ID: "test-feide-client-id",
    FEIDE_CLIENT_SECRET: "test-feide-client-secret",
    NODE_ENV: "test",
    PORT: 4000,
    MAIL_FROM: "",
    MAIL_PORT: 0,
    REDIS_URL: "",
    REFRESH_VIPPS_WEBHOOKS: false,
    ROOT_URL: "http://localhost:4000",
    SEED_DB: false,
    VIPPS_TEST_MODE: true,
    WEBHOOK_URL: "",
    MAIL_HOST: "",
    MAIL_PASS: "",
    MAIL_USER: "",
    EMAIL_API_KEY: "test-email-api-key",
    VIPPS_CLIENT_ID: "abc",
    VIPPS_CLIENT_SECRET: "abc",
    VIPPS_MERCHANT_SERIAL_NUMBER: "abc",
    VIPPS_SUBSCRIPTION_KEY: "abc",
};

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 */
export const env =
    process.env.NODE_ENV === "test"
        ? testEnvVariables
        : envSchema.parse(process.env);
