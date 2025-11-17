import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    admin,
    bearer,
    createAuthMiddleware,
    emailOTP,
    openAPI,
} from "better-auth/plugins";
import * as schema from "~/db/schema";
import { enqueueEmail } from "~/lib/email";
import ChangeEmailVerificationEmail from "~/lib/email/template/change-email-verification";
import OtpSignInEmail from "~/lib/email/template/otp-sign-in";
import ResetPasswordEmail from "~/lib/email/template/reset-password";
import { env } from "~/lib/env";
import { type AppContext, createAppContext } from "../ctx";
import { feidePlugin, syncFeideHook } from "./feide";

export const createAuth = (ctx: Omit<AppContext, "auth">) =>
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
                await enqueueEmail(
                    {
                        component: ResetPasswordEmail({ url }),
                        subject: "Tilbakestill ditt passord",
                        to: user.email,
                    },
                    ctx,
                );
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
                    await enqueueEmail(
                        {
                            component: ChangeEmailVerificationEmail({ url }),
                            subject: "Verifiser din nye e-postadresse",
                            to: newEmail,
                        },
                        ctx,
                    );
                },
            },
        },
        plugins: [
            feidePlugin(),
            openAPI(),
            emailOTP({
                // Disable sign-up in production
                // Users should only sign up via Feide (or be migrated from Lepton)
                disableSignUp: env.NODE_ENV === "production",
                sendVerificationOTP: async ({ email, otp, type }) => {
                    await enqueueEmail(
                        {
                            component: OtpSignInEmail({ otp }),
                            subject: "Din engangskode",
                            to: email,
                        },
                        ctx,
                    );
                },
            }),
            admin(),
            bearer(),
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
            after: createAuthMiddleware(async (middlewareCtx) => {
                await syncFeideHook(middlewareCtx, ctx);
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
 * DO NOT USE
 * This is exported only for use with the BetterAuth CLI so it can discover the instance and resolve plugins
 * for generating database migrations.
 *
 * Mark as deprecated to visually discourage usage.
 * @deprecated
 */
export const auth = createAuth(await createAppContext());

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
