import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    admin,
    createAuthMiddleware,
    emailOTP,
    openAPI,
} from "better-auth/plugins";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "~/db/schema";
import { sendEmail } from "~/lib/email";
import ChangeEmailVerificationEmail from "~/lib/email/template/change-email-verification";
import OtpSignInEmail from "~/lib/email/template/otp-sign-in";
import ResetPasswordEmail from "~/lib/email/template/reset-password";
import { env } from "~/lib/env";
import type { DbSchema } from "../../db";
import type { RedisClient } from "../cache/redis";
import { feidePlugin, syncFeideHook } from "./feide";

export const createAuth = (ctx: {
    db: NodePgDatabase<DbSchema>;
    /** Redis client instance */
    redis: RedisClient;
}) =>
    betterAuth({
        database: drizzleAdapter(ctx.db, {
            provider: "pg",
            schema,
        }),
        baseURL: env.ROOT_URL,
        emailAndPassword: {
            enabled: true,
            disableSignUp: true,
            requireEmailVerification: true,
            sendResetPassword: async ({ url, user }) => {
                await sendEmail({
                    component: ResetPasswordEmail({ url }),
                    subject: "Tilbakestill ditt passord",
                    to: user.email,
                });
            },
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
                        component: ChangeEmailVerificationEmail({ url }),
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
                        component: OtpSignInEmail({ otp }),
                        subject: "Din engangskode",
                        to: email,
                    });
                },
            }),
            admin(),
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
                return await ctx.redis.get(key);
            },
            set: async (key, value, ttl) => {
                if (ttl) await ctx.redis.set(key, value, { EX: ttl });
                else await ctx.redis.set(key, value);
            },
            delete: async (key) => {
                await ctx.redis.del(key);
            },
        },
    });

/**
 * The type of the BetterAuth instance
 */
export type AuthInstance = ReturnType<typeof createAuth>;

/**
 * A user session
 */
export type Session = AuthInstance["$Infer"]["Session"]["session"];

/**
 * User data
 */
export type User = AuthInstance["$Infer"]["Session"]["user"];
