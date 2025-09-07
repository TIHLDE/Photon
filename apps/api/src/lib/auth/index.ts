import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    createAuthMiddleware,
    emailOTP,
    openAPI,
    username,
} from "better-auth/plugins";
import db from "~/db";
import * as schema from "~/db/schema";
import { feidePlugin, syncFeideHook } from "./feide";
import { env } from "../env";
import { sendEmail } from "../email";
import ChangeEmailVerification from "../email/template/change-email-verification";
import OtpSignIn from "../email/template/otp-sign-in";
import { getRedis } from "../cache/redis";

const redis = await getRedis();

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    baseURL: env.BASE_URL,
    emailAndPassword: {
        enabled: false,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
    },
    advanced: {
        crossSubDomainCookies: {
            enabled: true,
        },
    },
    trustedOrigins: [
        "https://tihlde.org",
        "https://*.tihlde.org",
        "localhost:*",
    ],
    user: {
        additionalFields: {
            /**
             * @deprecated Backwards-compatibility from Lepton auth system
             *
             * Legacy token is a never-changing(!) token that is used to authenticate against Lepton.
             * Until that API is fully removed, we keep this stored and send as cookie on sign-in
             * to keep the old endpoints working from the browser.
             */
            legacyToken: {
                type: "string",
                required: false,
                unique: false,
                input: false,
            },
        },
        changeEmail: {
            enabled: true,
            sendChangeEmailVerification: async ({ newEmail, url }) => {
                sendEmail({
                    component: ChangeEmailVerification({ url }),
                    subject: "Verifiser din nye e-postadresse",
                    to: newEmail,
                });
            },
        },
    },
    plugins: [
        feidePlugin(),
        openAPI(),
        emailOTP({
            // TODO disable signups when in production
            // users should only sign up via Feide (or be migrated from Lepton)
            disableSignUp: false,
            sendVerificationOTP: async ({ email, otp, type }) => {
                if (type !== "sign-in") return;

                sendEmail({
                    component: OtpSignIn({ otp }),
                    subject: "Din engangskode",
                    to: email,
                });
            },
        }),
    ],
    logger: {
        disabled: false,
        level: "debug",
        log: (level, message, ...args) => {
            // Custom logging implementation
            console.log(`[${level}] ${message}`, ...args);
        },
    },
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            await syncFeideHook(ctx);
        }),
    },
    secondaryStorage: {
        get: async (key) => {
            return await redis.get(key);
        },
        set: async (key, value, ttl) => {
            if (ttl) await redis.set(key, value, { EX: ttl });
            else await redis.set(key, value);
        },
        delete: async (key) => {
            await redis.del(key);
        },
    },
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
