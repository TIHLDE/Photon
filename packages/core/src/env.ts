import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

if (process.env.NODE_ENV !== "test") {
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
}

const toBoolean =
    ({ defaultVal }: { defaultVal: boolean }) =>
    (val: string | undefined) => {
        if (!val) {
            return defaultVal;
        }

        return val.toLowerCase() === "true" || val === "1";
    };

/**
 * Frontend origins production trusts in addition to WEBSITE_URL.
 *
 * The website moves from new.tihlde.org to tihlde.org, but WEBSITE_URL lives
 * in Drift's environment rather than this repo — the Vercel domain move and
 * that variable cannot flip in the same instant. Trusting the whole set makes
 * the cutover order-independent, and keeps links that still point at
 * new.tihlde.org (sent emails, Vipps return URLs) working afterwards.
 */
const PRODUCTION_WEBSITE_ORIGINS = [
    "https://tihlde.org",
    "https://www.tihlde.org",
    "https://new.tihlde.org",
];

/**
 * Origin form of a URL ("https://tihlde.org/" -> "https://tihlde.org"), so
 * comparisons against a browser's Origin header — which never carries a path
 * or trailing slash — do not fail on a stray slash in configuration.
 * Unparseable values are passed through for the caller to reject.
 */
function toOrigin(url: string): string {
    try {
        return new URL(url).origin;
    } catch {
        return url;
    }
}

const envSchema = z
    .object({
        // CONFIG
        ROOT_URL: z.string().default("http://localhost:4000"),
        /** Frontend origin. Defaulted per NODE_ENV below, not here. */
        WEBSITE_URL: z.string().optional(),
        /**
         * Comma-separated extra frontend origins to trust alongside
         * WEBSITE_URL. Defaulted per NODE_ENV below, not here.
         */
        EXTRA_WEBSITE_ORIGINS: z.string().optional(),
        PORT: z
            .string()
            .default("4000")
            .transform((val) => Number(val)),
        WEBHOOK_URL: z.string().optional().default(""),
        NODE_ENV: z
            .enum(["production", "development", "test"])
            .default("development"),
        MAX_TEST_WORKERS: z
            .string()
            .default("1")
            .transform((val) => Number(val)),

        // AUTH
        /** Better Auth signing secret. Must be set in production; createAuth throws if it isn't. */
        AUTH_SECRET: z.string().default(""),

        // DATABASE
        DATABASE_URL: z.string().default(""),
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
        FEIDE_CLIENT_ID: z.string().default(""),
        FEIDE_CLIENT_SECRET: z.string().default(""),

        // EMAIL
        MAIL_HOST: z.string().optional(),
        MAIL_PORT: z
            .string()
            .default("587")
            .transform((val) => Number(val)),
        MAIL_USER: z.string().optional(),
        MAIL_PASS: z.string().optional(),
        MAIL_FROM: z.string().default("no-reply@tihlde.org"),
        EMAIL_API_KEY: z.string().default("test-email-api-key"),
        /** Where the "for bedrifter" contact form delivers its submissions */
        COMPANY_CONTACT_EMAIL: z
            .string()
            .default("naeringslivsminister@tihlde.org"),
        /**
         * Where "jeg får ikke koblet Feide til den gamle brukeren min" lands.
         * These need a human: the member has proved nothing yet, so linking
         * their accounts is a judgement call, not something the flow can
         * automate.
         */
        ACCOUNT_HELP_EMAIL: z.string().default("index@tihlde.org"),
        EMAIL_PROXY_URL: z.string().optional(),
        EMAIL_PROXY_KEY: z.string().optional(),

        // GOOGLE (møtetid calendar sync)
        GOOGLE_CLIENT_ID: z.string().optional(),
        GOOGLE_CLIENT_SECRET: z.string().optional(),

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
    })
    .transform((vals) => {
        // A localhost frontend in production is never right: WEBSITE_URL
        // anchors the allowed CORS origins there (see app.ts), so falling back
        // to the dev default would block the real site from its own API.
        const websiteUrl =
            vals.WEBSITE_URL ||
            (vals.NODE_ENV === "production"
                ? "https://tihlde.org"
                : "http://localhost:3000");

        const extraOrigins = vals.EXTRA_WEBSITE_ORIGINS
            ? vals.EXTRA_WEBSITE_ORIGINS.split(",")
                  .map((origin) => origin.trim())
                  .filter(Boolean)
            : vals.NODE_ENV === "production"
              ? PRODUCTION_WEBSITE_ORIGINS
              : [];

        const resolved = {
            ...vals,
            WEBSITE_URL: websiteUrl,
            /**
             * Every frontend origin the API accepts, WEBSITE_URL first. Only
             * WEBSITE_URL is used to *build* links (emails, redirects); the
             * rest are accepted on the way in.
             */
            WEBSITE_ORIGINS: [
                ...new Set([websiteUrl, ...extraOrigins].map(toOrigin)),
            ],
        };

        if (!resolved.WEBHOOK_URL) {
            return { ...resolved, WEBHOOK_URL: resolved.ROOT_URL };
        }

        console.warn(`🪝 Using custom webhook URL: ${resolved.WEBHOOK_URL}`);
        return resolved;
    });

type Env = z.infer<typeof envSchema>;
type EnvInput = z.input<typeof envSchema>;

let _env: Env | undefined;

/**
 * Retired env var names, mapped to the name that replaced them.
 *
 * Deployments outlive renames. Production still defines BETTER_AUTH_SECRET and
 * its environment is not ours to edit, so a rename that lands only in code
 * takes the API down on the next boot — `createAuth` refuses to start without a
 * secret. Reading the old name keeps those deployments alive until every
 * environment has caught up.
 */
const LEGACY_ENV_ALIASES: Record<string, string> = {
    AUTH_SECRET: "BETTER_AUTH_SECRET",
};

/** Fills in any current name that is unset but whose retired name still is. */
function withLegacyAliases(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const resolved = { ...source };

    for (const [current, legacy] of Object.entries(LEGACY_ENV_ALIASES)) {
        if (!resolved[current] && source[legacy]) {
            resolved[current] = source[legacy];
            console.warn(
                `⚠️ ${legacy} is deprecated — rename it to ${current}.`,
            );
        }
    }

    return resolved;
}

/**
 * Validate an environment without touching the cached singleton.
 * Exported for testing; application code should use `env`.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
    return envSchema.parse(withLegacyAliases(source));
}

function getEnv(): Env {
    if (!_env) {
        _env = parseEnv(process.env);
    }
    return _env;
}

/**
 * The application's environment variables.
 * Use this instead of `process.env` directly, to ensure type safety.
 *
 * Reads from .env file (via dotenvx) and validates with Zod.
 * Every field has a default or is optional, so parsing never throws —
 * works in dev, tests, and CI without special configuration.
 *
 * Validation runs on first property access, not on import.
 */
export const env: Env = new Proxy({} as Env, {
    get(_, prop: string) {
        return getEnv()[prop as keyof Env];
    },
});

export type { Env, EnvInput };
