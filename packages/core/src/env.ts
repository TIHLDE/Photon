import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { config } from "@dotenvx/dotenvx";
import { z } from "zod";

/**
 * Walk up from cwd to find the nearest .env file (repo root).
 */
function findEnvFile(): string | undefined {
    let dir = resolve(".");
    while (true) {
        const candidate = join(dir, ".env");
        if (existsSync(candidate)) return candidate;
        const parent = dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
    }
}

try {
    const envPath = findEnvFile();
    if (envPath) {
        config({
            path: envPath,
            ignore: ["MISSING_ENV_FILE"],
            quiet: true,
        });
    }
} catch (e) {
    console.warn("⚠️ Could not load .env file, proceeding without it.");
}

const toBoolean =
    ({ defaultVal }: { defaultVal: boolean }) =>
    (val: string | undefined) => {
        if (!val) {
            return defaultVal;
        }

        return val.toLowerCase() === "true" || val === "1";
    };

// Pre-process: default WEBHOOK_URL to ROOT_URL if empty
const runtimeEnv = { ...process.env };
if (!runtimeEnv.WEBHOOK_URL) {
    runtimeEnv.WEBHOOK_URL = runtimeEnv.ROOT_URL ?? "http://localhost:4000";
} else {
    console.warn(`🪝 Using custom webhook URL: ${runtimeEnv.WEBHOOK_URL}`);
}

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(["production", "development", "test"]),
        ROOT_URL: z.string().default("http://localhost:4000"),
        WEBSITE_URL: z.string().default("http://localhost:3000"),
        PORT: z
            .string()
            .default("4000")
            .transform((val) => Number(val)),
        WEBHOOK_URL: z.string(),
        MAX_TEST_WORKERS: z
            .string()
            .default("1")
            .transform((val) => Number(val)),

        // DATABASE
        DATABASE_URL: z.string(),
        SEED_DB: z
            .string()
            .optional()
            .transform(toBoolean({ defaultVal: false })),
        REDIS_URL: z.string().default("redis://localhost:6379"),

        // S3-COMPATIBLE STORAGE
        S3_ENDPOINT: z.string().default("localhost:9000"),
        S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
        S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
        S3_BUCKET_NAME: z.string().default("photon-files"),
        S3_REGION: z.string().default("us-east-1"),
        S3_USE_SSL: z
            .string()
            .optional()
            .transform(toBoolean({ defaultVal: false })),
        S3_FORCE_PATH_STYLE: z
            .string()
            .optional()
            .transform(toBoolean({ defaultVal: true })),

        // FEIDE
        FEIDE_CLIENT_ID: z.string(),
        FEIDE_CLIENT_SECRET: z.string(),

        // EMAIL
        MAIL_HOST: z.string().optional(),
        MAIL_PORT: z
            .string()
            .default("587")
            .transform((val) => Number(val)),
        MAIL_USER: z.string().optional(),
        MAIL_PASS: z.string().optional(),
        MAIL_FROM: z.string().default("no-reply@tihlde.org"),
        EMAIL_API_KEY: z.string().optional(),

        // VIPPS
        VIPPS_SUBSCRIPTION_KEY: z.string().optional(),
        VIPPS_CLIENT_ID: z.string().optional(),
        VIPPS_CLIENT_SECRET: z.string().optional(),
        VIPPS_MERCHANT_SERIAL_NUMBER: z.string().optional(),
        REFRESH_VIPPS_WEBHOOKS: z
            .string()
            .optional()
            .transform(toBoolean({ defaultVal: false })),
        VIPPS_TEST_MODE: z
            .string()
            .optional()
            .transform(toBoolean({ defaultVal: false })),
    },
    runtimeEnv,
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,
    emptyStringAsUndefined: true,
});

export type Env = typeof env;
