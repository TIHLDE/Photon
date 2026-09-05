import type { EnvInput } from "@photon/core/env";

type RequiredEnvKey = {
    [Key in keyof EnvInput]-?: undefined extends EnvInput[Key] ? never : Key;
}[keyof EnvInput];

type TestEnv = Record<RequiredEnvKey, string> &
    Partial<Record<keyof EnvInput, string>>;

const testEnv = {
    NODE_ENV: "test",
    AUTH_SECRET: "test-auth-secret",
    ROOT_URL: "http://localhost:4000",
    WEBSITE_URL: "http://localhost:3000",
    MAX_TEST_WORKERS: "1",
    MAIL_FROM: "no-reply@test.tihlde.org",
    MAIL_ALLOWED_FROM: "hs@test.tihlde.org",
    EMAIL_API_KEY: "test-email-api-key",

    //
    // TODO: REMOVE THIS ONCE DRIFT SERVERS IS UP
    //
    ASSET_WRITE_TARGET: "r2",
} satisfies TestEnv;

Object.assign(process.env, testEnv);
