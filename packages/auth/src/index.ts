import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
    admin,
    bearer,
    customSession,
    emailOTP,
    jwt,
    openAPI,
    username,
} from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { createAuthMiddleware } from "better-auth/api";
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
import { hasPermission } from "./rbac/permissions/checker";
import { loadUserRolesAndGroups } from "./lib/user-claims";

const OAUTH_CLIENT_ACTION_PERMISSION = {
    create: "oauth-clients:create",
    read: "oauth-clients:view",
    list: "oauth-clients:view",
    update: "oauth-clients:update",
    rotate: "oauth-clients:update",
    delete: "oauth-clients:delete",
} as const satisfies Record<
    "create" | "read" | "update" | "delete" | "list" | "rotate",
    string
>;

/**
 * Context required to create the auth instance.
 * Uses narrow types instead of full AppContext.
 */
export interface AuthCreateContext {
    db: NodePgDatabase<DbSchema>;
    redis: RedisClient;
    mailer: EmailTransporter;
    queue: QueueManager;
    bucket: StorageClient;
}

export const createAuth = (
    ctx: AuthCreateContext,
    { isDev = false }: { isDev?: boolean } = {},
) =>
    betterAuth({
        database: drizzleAdapter(ctx.db, {
            provider: "pg",
            schema,
        }),
        baseURL: env.ROOT_URL,
        emailAndPassword: {
            enabled: true,
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
            // Required by @better-auth/oauth-provider when secondaryStorage is set.
            // Sessions are still cached in Redis; this just keeps the DB row too.
            storeSessionInDatabase: true,
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
            ...(isDev
                ? [
                      "http://localhost:3000",
                      "http://localhost:4000",
                      "localhost:3000",
                  ]
                : []),
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
                async sendChangeEmailConfirmation({ newEmail, url }) {
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
            jwt(),
            oauthProvider({
                loginPage: "/login",
                consentPage: "/oauth/consent",
                signup: { page: "/register" },
                scopes: [
                    "openid",
                    "profile",
                    "email",
                    "offline_access",
                    "groups",
                    "roles",
                ],
                clientPrivileges: async ({ user, action }) => {
                    if (!user) return false;
                    const perm = OAUTH_CLIENT_ACTION_PERMISSION[action];
                    return await hasPermission({ db: ctx.db }, user.id, [
                        perm,
                        "oauth-clients:manage",
                    ]);
                },
                customIdTokenClaims: async ({ user, scopes }) => {
                    const wantsRoles = scopes.includes("roles");
                    const wantsGroups = scopes.includes("groups");
                    if (!wantsRoles && !wantsGroups) return {};
                    const { permissions, groups } =
                        await loadUserRolesAndGroups({ db: ctx.db }, user.id);
                    return {
                        ...(wantsRoles ? { permissions } : {}),
                        ...(wantsGroups ? { groups } : {}),
                    };
                },
                customUserInfoClaims: async ({ user, scopes }) => {
                    const wantsRoles = scopes.includes("roles");
                    const wantsGroups = scopes.includes("groups");
                    if (!wantsRoles && !wantsGroups) return {};
                    const { permissions, groups } =
                        await loadUserRolesAndGroups({ db: ctx.db }, user.id);
                    return {
                        ...(wantsRoles ? { permissions } : {}),
                        ...(wantsGroups ? { groups } : {}),
                    };
                },
            }),
            customSession(async ({ user, session }) => {
                const [settings, { permissions, groups }] = await Promise.all([
                    ctx.db.query.userSettings.findFirst({
                        where: (s, { eq }) => eq(s.userId, user.id),
                        with: { allergies: { columns: { allergySlug: true } } },
                    }),
                    loadUserRolesAndGroups({ db: ctx.db }, user.id),
                ]);

                return {
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
                    permissions,
                    groups,
                };
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
