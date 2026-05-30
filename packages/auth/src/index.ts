import { betterAuth, BetterAuthOptions, DBAdapter } from "better-auth";
import { admin, jwt, openAPI, username } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import {
    oauthProviderAuthServerMetadata,
    oauthProviderOpenIdConfigMetadata,
} from "@better-auth/oauth-provider";
import type { EmailService, CacheService } from "@photon/core/services";

export interface CreateAuthOptions {
    isDevMode?: boolean;
    secret: string;

    urls: {
        frontend: string;
        backend: string;
        basePath: string;
        additionalTrusted: string[];
    };

    services: {
        database: (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;
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

    return betterAuth({
        appName: "Photon, TIHLDE Backend",
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
        secret: options.secret,
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
            jwt(),
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
        ],
    });
}

export type AuthInstance = ReturnType<typeof createAuth>;
export type AuthSession = AuthInstance["$Infer"]["Session"]["session"];
export type AuthUser = AuthInstance["$Infer"]["Session"]["user"];

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
