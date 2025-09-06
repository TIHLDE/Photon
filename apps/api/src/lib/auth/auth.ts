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
import { feideAuthPlugin, syncFeideHook } from "./feide";
import { env } from "../env";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    baseURL: env.BASE_URL,
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
    advanced: {
        crossSubDomainCookies: {
            enabled: true,
        },
    },
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
    },
    plugins: [
        feideAuthPlugin,
        openAPI(),
        emailOTP({
            sendVerificationOTP: async ({ email, otp, type }) => {
                if (type === "sign-in") {
                    // Send the OTP for sign in
                } else if (type === "email-verification") {
                    // Send the OTP for email verification
                } else {
                    // Send the OTP for password reset
                }
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
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
