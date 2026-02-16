import * as schema from "@photon/db/schema";
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
import type { AuthDeps } from "../types";
import { feidePlugin, syncFeideHook } from "./feide";
import { syncLegacyTokenHook } from "./lepton";
import { getUserPermissions } from "./rbac/permissions";

export const createAuth = (deps: AuthDeps) =>
    betterAuth({
        database: drizzleAdapter(deps.db, {
            provider: "pg",
            schema,
        }),
        baseURL: deps.baseURL,
        emailAndPassword: {
            enabled: true,
            disableSignUp: true,
            requireEmailVerification: true,
            sendResetPassword: async ({ url, user }) => {
                await deps.sendEmail?.resetPassword?.({
                    url,
                    email: user.email,
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
            cookiePrefix: "photon",
        },
        trustedOrigins: deps.trustedOrigins,
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
                    await deps.sendEmail?.changeEmailVerification?.({
                        url,
                        newEmail,
                    });
                },
            },
        },
        plugins: [
            feidePlugin(deps.feide),
            openAPI(),
            emailOTP({
                // Disable sign-up in production
                // Users should only sign up via Feide (or be migrated from Lepton)
                disableSignUp: deps.isProduction,
                sendVerificationOTP: async ({ email, otp, type }) => {
                    await deps.sendEmail?.otp?.({ email, otp, type });
                },
            }),
            admin(),
            bearer(),
            username(),
            customSession(async ({ user, session }) => {
                // TODO cleanup this code, is temprorary while we find out what info is needed
                // Fetch user settings with allergies
                const settings = await deps.db.query.userSettings.findFirst({
                    where: (s, { eq }) => eq(s.userId, user.id),
                    with: { allergies: { columns: { allergySlug: true } } },
                });

                // Fetch permissions (from roles + direct grants)
                const permissions = await getUserPermissions(
                    { db: deps.db },
                    user.id,
                );

                // Fetch user groups
                const groups = await deps.db.query.groupMembership.findMany({
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
                await syncFeideHook(middlewareCtx, deps);
                await syncLegacyTokenHook(middlewareCtx, deps);
            }),
        },
        secondaryStorage: {
            get: async (key) => {
                return await deps.redis.get(key);
            },
            set: async (key, value, ttl) => {
                if (ttl) await deps.redis.set(key, value, { EX: ttl });
                else await deps.redis.set(key, value);
            },
            delete: async (key) => {
                await deps.redis.del(key);
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

// Re-export everything that consumers of @photon/auth/server need
export type { AuthDeps } from "../types";
export * from "./rbac/permissions";
export * from "./rbac/roles";
export { requireAuth, captureAuth } from "./middleware/auth";
export {
    requireAccess,
    type OwnershipChecker,
    type RequireAccessOptions,
} from "./middleware/access";
export { requireApiKey, captureApiKey } from "./middleware/api-key";
export { requireAuthOrApiKey } from "./middleware/auth-or-api-key";
export { parseBearer, parseBearerOptional } from "./bearer";
export { parseValidStudyPrograms } from "./feide";
