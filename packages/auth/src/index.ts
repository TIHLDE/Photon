import {
    betterAuth,
    type BetterAuthOptions,
    type DBAdapter,
} from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
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
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { user } from "@photon/db/schema";
import type { EmailService, CacheService } from "@photon/core/services";
import { env } from "@photon/core/env";
import { getUserPermissions } from "./rbac/permissions";
import { feidePlugin, syncFeideHook } from "./feide";

/**
 * Feide is a genuine third-party identity provider: it only works once a Feide
 * client is registered in the Feide Kundeportal and its credentials land in the
 * environment. Until then the plugin is left out entirely rather than mounted
 * with an empty client id (which would send users to Dataporten with a broken
 * `client_id=` and fail confusingly). The frontend hides its Feide button
 * behind its own flag, so the two sides are enabled independently.
 */
const isFeideConfigured = Boolean(
    env.FEIDE_CLIENT_ID && env.FEIDE_CLIENT_SECRET,
);

/**
 * Self-registration is restricted to NTNU student addresses, and the username
 * is the local part of that address (`olanor@stud.ntnu.no` -> `olanor`).
 *
 * Deliberately scoped to the public `/sign-up/email` endpoint rather than a
 * `databaseHooks.user.create` hook: every other creation path (dev seeding,
 * integration tests, admin create-user and the Lepton migration) legitimately
 * carries other domains, and the migration in particular would silently drop
 * legacy members whose accounts predate the stud.ntnu.no rule.
 *
 * The local part must not be empty and cannot contain a second `@`, so a
 * plain `endsWith` check is not enough.
 */
const STUD_NTNU_EMAIL_PATTERN =
    /^([a-z0-9]+(?:[._-][a-z0-9]+)*)@stud\.ntnu\.no$/;

/**
 * Username a self-registration would get from `email`, or undefined when the
 * address is not one self-registration accepts.
 *
 * Exported so callers that create accounts through `signUpEmail` (the
 * `users:create` route) can answer "is this student already here?" before
 * handing the request to Better Auth, deriving the username exactly the way
 * the sign-up hook below does rather than re-implementing the rule.
 */
export function usernameFromStudentEmail(
    email: string | undefined,
): string | undefined {
    if (typeof email !== "string") return undefined;
    return STUD_NTNU_EMAIL_PATTERN.exec(email.trim().toLowerCase())?.[1];
}

/**
 * Longest domain suffix shared by two URLs' hostnames, or undefined when the
 * hosts are identical (host-only cookies already reach both) or share fewer
 * than two labels (never widen a cookie to a bare TLD or unrelated hosts).
 * `https://tihlde.org` + `https://photon.tihlde.org` -> `tihlde.org`.
 */
export function sharedParentDomain(a: string, b: string): string | undefined {
    const hostA = new URL(a).hostname;
    const hostB = new URL(b).hostname;
    if (hostA === hostB) return undefined;

    const labelsA = hostA.split(".");
    const labelsB = hostB.split(".");
    const shared: string[] = [];
    while (
        labelsA.length > 0 &&
        labelsB.length > 0 &&
        labelsA.at(-1) === labelsB.at(-1)
    ) {
        shared.unshift(labelsA.pop() as string);
        labelsB.pop();
    }

    if (shared.length < 2) return undefined;
    return shared.join(".");
}

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

/**
 * Point an auth action link's redirect back at the FRONTEND (WEBSITE_URL).
 *
 * Better Auth builds action URLs against its own baseURL (the backend) and
 * defaults `callbackURL` to "/" — a RELATIVE path that resolves against the
 * backend host when the user clicks the link, landing them on the API
 * (photon.tihlde.org) instead of the website. Rewrites relative callback
 * URLs to absolute frontend ones; absolute callbacks (e.g. the frontend's
 * own redirectTo for password resets) pass through untouched.
 *
 * Exported for testing.
 */
export function withFrontendCallback(
    rawUrl: string,
    frontendOrigin: string,
): string {
    try {
        const url = new URL(rawUrl);
        const callback = url.searchParams.get("callbackURL") ?? "/";
        if (callback.startsWith("/")) {
            url.searchParams.set(
                "callbackURL",
                new URL(callback, frontendOrigin).toString(),
            );
        }
        return url.toString();
    } catch {
        return rawUrl;
    }
}

/**
 * `preferred_username` for the id token and the userinfo endpoint.
 *
 * The TIHLDE username is what every other system keys members on — Fadderuka
 * stores it as `tihldeUserId`, and the Lepton export used it as the join key —
 * while `sub` is a Better Auth id nothing outside Photon has ever seen. A
 * client that only gets `sub` cannot match a member to rows it already holds,
 * so it would have to fall back to e-mail, which members change.
 *
 * A standard OIDC profile claim, hence no URI namespacing. Omitted rather than
 * sent as null when the account has no username: absent means "not provided",
 * whereas null invites a client to store it.
 */
function preferredUsernameClaim(
    u: Record<string, unknown> | null | undefined,
): Record<string, string> {
    const username = u?.username;
    return typeof username === "string" && username.length > 0
        ? { preferred_username: username }
        : {};
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

    /**
     * The frontend server-renders auth-guarded routes and must forward the
     * session cookie to the API. That only works if the browser sends the
     * cookie to the frontend host too — i.e. the cookie is scoped to the
     * shared parent domain (tihlde.org for tihlde.org + photon.tihlde.org),
     * not host-only for the API. Without this, a hard refresh on a guarded
     * page SSRs with no cookie and bounces a logged-in user to /login.
     *
     * Derived from the configured URLs so localhost dev (same hostname on
     * both sides — host-only cookies already work) stays untouched.
     */
    const cookieDomain = sharedParentDomain(
        options.urls.frontend,
        options.urls.backend,
    );

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
            // In dev, any localhost port is trusted so worktrees/dev servers
            // on non-default ports can authenticate.
            ...(options.isDevMode ? ["http://localhost:*"] : []),
        ],

        emailAndPassword: {
            enabled: true,
            requireEmailVerification: true,
            autoSignIn: true,
            async sendResetPassword({ user: u, url }) {
                await options.services.email.sendPasswordResetMail({
                    to: u.email,
                    url: withFrontendCallback(url, options.urls.frontend),
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
                    url: withFrontendCallback(url, options.urls.frontend),
                });
            },
        },

        account: {
            accountLinking: {
                /**
                 * Feide hands out `@ntnu.no` addresses, while 986 of the 1685
                 * accounts migrated from Lepton hold a private one. Two
                 * different addresses is therefore the normal case here, not
                 * the suspicious one, and without this Better Auth rejects the
                 * link with `email_doesn't_match` — precisely for the members
                 * who have no other way back to their history, since a
                 * matching username would have linked them automatically.
                 *
                 * Only relaxes the *explicit* link routes, where a session
                 * already proves the local account and the provider proves the
                 * Feide identity. The implicit linking done during sign-in
                 * never consults this flag, so `requireLocalEmailVerified`
                 * still guards that path untouched.
                 */
                allowDifferentEmails: true,
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
            crossSubDomainCookies: cookieDomain
                ? { enabled: true, domain: cookieDomain }
                : { enabled: false },
            defaultCookieAttributes: {
                httpOnly: true,
                sameSite: "lax",
                secure: isProd,
            },
        },

        hooks: {
            before: createAuthMiddleware(async (ctx) => {
                if (ctx.path !== "/sign-up/email") return;

                const rawEmail = ctx.body?.email;
                const email =
                    typeof rawEmail === "string"
                        ? rawEmail.trim().toLowerCase()
                        : "";

                const derivedUsername = usernameFromStudentEmail(email);
                if (!derivedUsername) {
                    throw new APIError("BAD_REQUEST", {
                        message:
                            "Registrering krever en @stud.ntnu.no-adresse.",
                    });
                }

                /**
                 * The username plugin's own uniqueness check never runs for
                 * this request, so it is made here.
                 *
                 * `runBeforeHooks` collects what each hook returns into a
                 * merged context but calls every hook with the ORIGINAL one, so
                 * the plugin's `/sign-up/email` hook — which runs after this
                 * one, plugin hooks being appended after the user hook — sees
                 * `body.username === undefined` and skips its whole validation.
                 * The plugin's database hook skips it too, since it treats
                 * `/sign-up/email` as already validated over HTTP. Without this,
                 * the only thing left is the unique index on `user.username`,
                 * and a driver error reaching the error handler is a 500 —
                 * which is what a student registering with an address that
                 * differs from the one their Feide account carries used to get.
                 */
                const takenBy = await options.services.db.query.user.findFirst({
                    where: eq(user.username, derivedUsername),
                    columns: { id: true },
                });
                if (takenBy) {
                    throw new APIError("CONFLICT", {
                        message:
                            "Det finnes allerede en bruker med dette NTNU-brukernavnet. Logg inn med Feide i stedet, eller bruk «glemt passord».",
                    });
                }

                // Username is derived, never taken from the request: a caller
                // must not be able to pick one that disagrees with their email.
                return {
                    context: {
                        body: { ...ctx.body, email, username: derivedUsername },
                    },
                };
            }),
            after: createAuthMiddleware(async (ctx) => {
                if (!isFeideConfigured) return;
                // Syncs the user's TIHLDE study-program memberships after a
                // successful Feide callback; a no-op for every other request.
                //
                // Never allowed to fail the request: by the time this runs the
                // session cookie is already set, so throwing would hand a
                // logged-in user a 500 at the callback URL instead of sending
                // them back to the website. A failed sync costs them their
                // baseline role until the next login — a 500 costs them the
                // login itself.
                try {
                    await syncFeideHook(ctx, { db: options.services.db });
                } catch (error) {
                    console.error("Feide sync failed after callback:", error);
                }
            }),
        },

        // Needed for the JWT plugin to work with oAuth Provider plugin
        disabledPaths: ["/token"],

        plugins: [
            admin(),
            openAPI(),
            // Always present so the plugins tuple stays stable for `$Infer`;
            // the Feide provider itself is gated inside feidePlugin() on the
            // credentials being set.
            feidePlugin(options.services.db),
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
                customIdTokenClaims: ({ user: u }) => preferredUsernameClaim(u),
                customUserInfoClaims: ({ user: u }) =>
                    preferredUsernameClaim(u),

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
                        logoUrl: g.group.logoUrl,
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
