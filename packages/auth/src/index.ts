import { betterAuth, BetterAuthOptions, DBAdapter } from "better-auth";
import {
    admin,
    customSession,
    jwt,
    openAPI,
    username,
} from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import {
    oauthProviderAuthServerMetadata,
    oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import type { EmailService, CacheService } from "@photon/core/services";
import { getUserPermissions } from "./rbac/permissions";

export interface CreateAuthOptions {
    isDevMode?: boolean;

    /**
     * Signing secret for sessions and tokens. Required in production —
     * `createAuth` throws if it is missing there.
     */
    secret: string;

    urls: {
        frontend: string;
        backend: string;
        basePath: string;
        additionalTrusted: string[];
    };

    services: {
        database: (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;
        /**
         * Raw Drizzle handle used by `customSession` to enrich the session with
         * settings, permissions and groups. `database` above is Better Auth's
         * own adapter and cannot answer these queries.
         */
        db: NodePgDatabase<DbSchema>;
        email: EmailService;
        cache: CacheService;
    };

    oauth: {
        pages: {
            login: string;
            consent: string;
        };
    };

    /// Used only for tests to make them not use expensive hashing algorithms
    DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM: boolean;
}

export function createAuth(options: CreateAuthOptions) {
    const isProd = options.isDevMode !== true;

    if (isProd && options.DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM === true) {
        throw new Error(
            `DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM was enabled in production environment`,
        );
    }

    if (isProd && !options.secret) {
        throw new Error(
            "AUTH_SECRET must be set in production; refusing to start with an unsigned auth instance",
        );
    }

    return betterAuth({
        appName: "Photon, TIHLDE Backend",
        secret: options.secret || undefined,
        database: options.services.database,
        baseURL: {
            allowedHosts: [
                options.urls.frontend,
                options.urls.backend,
                ...(options.isDevMode ? ["*localhost*"] : []),
            ],
            protocol: isProd ? "https" : "http",
            fallback: options.urls.backend,
        },

        secondaryStorage: options.services.cache,

        basePath: options.urls.basePath,
        trustedOrigins: [
            options.urls.backend,
            options.urls.frontend,
            ...options.urls.additionalTrusted,
        ],

        emailAndPassword: {
            enabled: true,
            requireEmailVerification: true,
            autoSignIn: true,
            async sendResetPassword({ user: u, url }) {
                await options.services.email.sendPasswordResetMail({
                    to: u.email,
                    url,
                });
            },
            ...(options.DANGEROUSLY_SET_INSECURE_HASHING_ALGORITHM && !isProd
                ? {
                      password: {
                          async hash(password: string) {
                              return password;
                          },
                          async verify({ hash, password }) {
                              if (hash === password) return true;
                              return false;
                          },
                      },
                  }
                : {}),
        },

        emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({ user: u, url }) => {
                await options.services.email.sendVerifyEmailMail({
                    to: u.email,
                    url,
                });
            },
        },

        session: {
            expiresIn: 60 * 60 * 24 * 30, // 30d
            updateAge: 60 * 60 * 24, // 1d
            storeSessionInDatabase: true,
            cookieCache: { enabled: true, maxAge: 60 * 5 },
        },

        advanced: {
            cookiePrefix: "tihlde",
            useSecureCookies: isProd,
            crossSubDomainCookies: { enabled: false },
            defaultCookieAttributes: {
                httpOnly: true,
                sameSite: "lax",
                secure: isProd,
            },
        },

        // Needed for the JWT plugin to work with oAuth Provider plugin
        disabledPaths: ["/token"],

        plugins: [
            admin(),
            openAPI(),
            // TODO: Add feide plugin later
            // feidePlugin(),
            username(),
            jwt({
                // Recommended by better-auth docs when using with OAuth Provider plugin
                disableSettingJwtHeader: true,
            }),

            oauthProvider({
                loginPage: options.oauth.pages.login,
                consentPage: options.oauth.pages.consent,

                // TOOD: Add custom scopes in the future
                // scopes: []

                // Q9 decision: roles + groups embedded in JWT access tokens.
                // 15-minute staleness window is accepted; document it for admins.
                customAccessTokenClaims: async ({ user: u }) => {
                    if (!u) return {};

                    // TODO: Enrich the access token claims with more information
                    // const [roles, groups] = await Promise.all([
                    //     loadRoles(u.id),
                    //     loadGroups(u.id),
                    // ]);

                    return {};
                },
                customIdTokenClaims: () => ({}),
                customUserInfoClaims: () => ({}),

                prefix: {
                    clientSecret: "tihlde_cs_",
                    accessToken: "tihlde_at_",
                    idToken: "tihlde_idt_",
                    opaqueAccessToken: "tihlde_oat_",
                    refreshToken: "tihlde_rt_",
                },
            }),

            // Must stay last: it wraps the session shape produced by the
            // plugins above, and `ExtendedSession` is inferred from the result.
            customSession(async ({ user, session }) => {
                const db = options.services.db;

                const [settings, permissions, groups] = await Promise.all([
                    db.query.userSettings.findFirst({
                        where: (s, { eq }) => eq(s.userId, user.id),
                        with: { allergies: { columns: { allergySlug: true } } },
                    }),
                    getUserPermissions({ db }, user.id),
                    db.query.groupMembership.findMany({
                        where: (gm, { eq }) => eq(gm.userId, user.id),
                        with: { group: true },
                    }),
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
                    permissions: [...new Set(permissions)],
                    groups: groups.map((g) => ({
                        slug: g.groupSlug,
                        name: g.group.name,
                        type: g.group.type,
                        role: g.role,
                    })),
                };
            }),
        ],
    });
}

export type AuthInstance = ReturnType<typeof createAuth>;
export type AuthSession = AuthInstance["$Infer"]["Session"]["session"];
export type AuthUser = AuthInstance["$Infer"]["Session"]["user"];

/**
 * Full session returned by get-session: user + settings, permissions and groups.
 * Source of truth for the SDK's generated `session-types.ts`.
 */
export type ExtendedSession = AuthInstance["$Infer"]["Session"];

export function createOAuthServerMetadata(auth: AuthInstance) {
    return oauthProviderAuthServerMetadata(auth, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
        },
    });
}

export function createOAuthOpenIDConfigMetadata(auth: AuthInstance) {
    return oauthProviderOpenIdConfigMetadata(auth, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
        },
    });
}

export { drizzleAdapter } from "better-auth/adapters/drizzle";
