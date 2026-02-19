import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    admin,
    bearer,
    createAuthMiddleware,
    customSession,
    emailOTP,
    openAPI,
    username,
} from "better-auth/plugins";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@photon/db/schema";
import type { DbSchema } from "@photon/db";
import { enqueueEmail } from "@photon/email";
import type { EmailTransporter } from "@photon/email";
import {
    ChangeEmailVerificationEmail,
    OtpSignInEmail,
    ResetPasswordEmail,
} from "@photon/email/templates";
import { env } from "@photon/core/env";
import type { RedisClient, QueueManager } from "@photon/core/cache";
import type { StorageClient } from "./types";
import { feidePlugin, syncFeideHook } from "./feide";
import { syncLegacyTokenHook } from "./lepton";
import { getUserPermissions } from "./rbac/permissions";

/**
 * Context required to create the auth instance.
 * Uses narrow types instead of full AppContext.
 */
export interface AuthCreateContext {
    db: NodePgDatabase<DbSchema>;
    redis: RedisClient;
    mailer: EmailTransporter;
    queue: QueueManager;
    bucket: StorageClient | null;
}

export const createAuth = (ctx: AuthCreateContext) =>
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
            cookiePrefix: "photon",
        },
        trustedOrigins: [
            "https://tihlde.org",
            "https://*.tihlde.org",
            "localhost:3000",
            "http://localhost:3000",
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
            username(),
            customSession(async ({ user, session }) => {
                // TODO cleanup this code, is temprorary while we find out what info is needed
                // Fetch user settings with allergies
                const settings = await ctx.db.query.userSettings.findFirst({
                    where: (s, { eq }) => eq(s.userId, user.id),
                    with: { allergies: { columns: { allergySlug: true } } },
                });

                // Fetch permissions (from roles + direct grants)
                const permissions = await getUserPermissions(
                    { db: ctx.db },
                    user.id,
                );

                // Fetch user groups
                const groups = await ctx.db.query.groupMembership.findMany({
                    where: (gm, { eq }) => eq(gm.userId, user.id),
                    with: {
                        group: true,
                    },
                });

                const fullSession = {
                    user: {
                        ...user,
                        settings: settings
                            ? {
                                  ...settings,
                                  allergies: settings.allergies.map(
                                      (a) => a.allergySlug,
                                  ),
                              }
                            : null,
                    },
                    session,
                    permissions: [...new Set(permissions)], // Deduplicated
                    groups: groups.map((g) => ({
                        slug: g.groupSlug,
                        name: g.group.name,
                        type: g.group.type,
                        role: g.role,
                    })),
                };
                console.log(fullSession);

                return fullSession;
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
            after: createAuthMiddleware(async (middlewareCtx) => {
                await syncFeideHook(middlewareCtx, ctx);
                await syncLegacyTokenHook(middlewareCtx, ctx);
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

/**
 * Extended session response from get-session endpoint.
 * Includes user with settings and computed permissions.
 */
export type ExtendedSession = AuthInstance["$Infer"]["Session"];
