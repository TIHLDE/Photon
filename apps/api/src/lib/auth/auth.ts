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
            sendChangeEmailVerification: async ({
                newEmail,
                token,
                url,
                user,
            }) => {
                // TODO send email
            },
        },
    },
    plugins: [
        feidePlugin(),
        openAPI(),
        emailOTP({
            sendVerificationOTP: async ({ email, otp, type }) => {
                switch (type) {
                    case "sign-in":
                        // TODO send email
                        break;

                    case "email-verification":
                        // TODO send email
                        break;
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
