import { AsyncLocalStorage } from "node:async_hooks";
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
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DbSchema } from "@photon/db";
import { account, user } from "@photon/db/schema";
import type { EmailService, CacheService } from "@photon/core/services";
import { env } from "@photon/core/env";
import { getUserPermissions } from "./rbac/permissions";
import {
    feidePlugin,
    isFeideCheckCurrent,
    recoverMissingBaselineRole,
    redirectToPasswordSetupAfterRevoke,
    revokeUnprovenCredentials,
    syncFeideHook,
} from "./feide";
import { syncDeEldstesRaad } from "./de-eldstes-raad";

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
 * A student address, whose local part is the NTNU username
 * (`olanor@stud.ntnu.no` -> `olanor`).
 *
 * Self-registration is no longer restricted to these — anyone may sign up with
 * a private address and wait for an admin to approve them — but a stud address
 * still gets special treatment: the username is taken from it and nothing else,
 * because that is the value a later Feide login matches the account on.
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
 * How many approval-queue mails one process will send per hour.
 *
 * The trigger is `/sign-up/email`, which anyone on the internet can reach, so
 * without a ceiling "register an account" doubles as a way to bury the
 * teknologiminister's inbox. The cap is per process rather than in Redis
 * because the failure it guards against is volume, not precision — a few extra
 * mails across instances cost nothing, and a shared counter would put a store
 * round trip in the sign-up path.
 *
 * Volume in production has been 1 self-registration ever, so any legitimate
 * burst is already a signal worth looking into on its own.
 */
const APPROVAL_MAILS_PER_HOUR = 10;
const approvalMailTimes: number[] = [];

/**
 * Tell whoever owns the approval queue that somebody is waiting in it.
 *
 * Failure is swallowed on purpose, the same way `approve.ts` treats its mail:
 * the account was created and is waiting either way, and a mail server having
 * a bad afternoon must not turn a successful sign-up into a 500.
 */
async function notifyApprovalQueue(
    email: EmailService,
    frontendUrl: string,
    member: { name: string; email: string; username: string | null },
): Promise<void> {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    while (approvalMailTimes.length > 0 && approvalMailTimes[0]! < hourAgo) {
        approvalMailTimes.shift();
    }
    if (approvalMailTimes.length >= APPROVAL_MAILS_PER_HOUR) {
        console.warn(
            "Suppressed an approval-queue notification: hourly cap reached.",
        );
        return;
    }
    approvalMailTimes.push(now);

    try {
        await email.sendEmail(
            {
                from: env.MAIL_FROM,
                to: env.ACCOUNT_APPROVAL_NOTIFY_EMAIL,
                subject: "Ny bruker venter på godkjenning",
            },
            {
                type: "text",
                text: [
                    `${member.name} har registrert seg på tihlde.org og venter på godkjenning.`,
                    "",
                    `E-post: ${member.email}`,
                    `Brukernavn: ${member.username ?? "(ikke satt)"}`,
                    "",
                    `Godkjenn her: ${frontendUrl}/admin/brukere`,
                ].join("\n"),
            },
        );
    } catch (error) {
        console.error("Failed to notify the approval queue:", error);
    }
}

/** Shape a caller-supplied username has to have: the same one Feide hands out. */
const USERNAME_PATTERN = /^[a-z0-9]{1,15}$/;

/**
 * Shape a username may have when the person picks it themselves, signing up
 * with a private address.
 *
 * Wider than `USERNAME_PATTERN` on purpose. Private addresses routinely have
 * local parts like `ola.nordmann`, and that is what the username is derived
 * from — narrowing it by stripping the dot would turn `ola.nordmann` into
 * `olanordmann`, which is exactly the shape NTNU hands out and therefore the
 * shape most likely to collide with a real student's username later.
 */
const SELF_CHOSEN_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;

/**
 * Username a self-registration derives from the local part of `email`, or
 * undefined when that local part is not a usable username.
 *
 * Only used for addresses that are not stud ones; a stud address goes through
 * `usernameFromStudentEmail`, whose stricter rule is what a Feide login later
 * matches on.
 */
export function usernameFromEmailLocalPart(
    email: string | undefined,
): string | undefined {
    if (typeof email !== "string") return undefined;
    const localPart = email.trim().toLowerCase().split("@")[0] ?? "";
    return SELF_CHOSEN_USERNAME_PATTERN.test(localPart) ? localPart : undefined;
}

/** Normalised form of a username typed into the sign-up form. */
function normaliseUsername(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A sign-up performed by a trusted server-side caller, for the duration of one
 * `signUpEmail` call. `username`, when present, is used as-is.
 *
 * Fadderuka registers brand-new students during fadderuka, and many of them
 * have not been given their @stud.ntnu.no address yet — so the address cannot
 * be what the username is derived from. They type their Feide username instead,
 * which is what makes a later Feide login land on the same account.
 *
 * The store is also what tells the two kinds of sign-up apart afterwards: a
 * trusted caller has already established the person's right to an account, so
 * their account is not marked as awaiting approval, while a sign-up arriving
 * over plain HTTP always is.
 *
 * A trusted username is deliberately NOT read from the request body. A
 * body-supplied one would let anyone claim a student's NTNU username before
 * that student ever registers — see the sign-up hook, which only honours a
 * body username for addresses NTNU did not issue. Async-local storage cannot
 * be reached over HTTP: only code inside `runTrustedSignUp` sees it, and the
 * one caller is the API-key route that has already checked `users:create`.
 */
const trustedSignUpStore = new AsyncLocalStorage<{ username?: string }>();

/**
 * Run `fn` as a trusted sign-up: the account skips admin approval, and
 * `username` — when given — is used instead of deriving one from the address.
 */
export function runTrustedSignUp<T>(
    username: string | undefined,
    fn: () => Promise<T>,
): Promise<T> {
    if (username === undefined) {
        return trustedSignUpStore.run({}, fn);
    }

    const normalised = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalised)) {
        throw new APIError("BAD_REQUEST", {
            message:
                "Brukernavnet kan bare inneholde små bokstaver og tall, og maks 15 tegn.",
        });
    }
    return trustedSignUpStore.run({ username: normalised }, fn);
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

    /**
     * The user's permission strings, deduplicated, for the OAuth token and
     * userinfo claims. Same source as the session's `permissions`, so a client
     * sees exactly what the website does.
     */
    const permissionClaims = async (userId: string) => {
        const permissions = await getUserPermissions(
            { db: options.services.db },
            userId,
        );
        return { permissions: [...new Set(permissions)] };
    };

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
            /**
             * A completed reset already proves the inbox: the token only
             * exists in a mail sent to that address, and `/reset-password`
             * refuses to run without it. Demanding a verification mail on top
             * asks for the same proof twice — which is exactly what the 1685
             * migrated members hit, since they arrive with `emailVerified`
             * false and no password they know, so a reset is their only way
             * in. Crediting the proof we already have is what turns that
             * round trip from a dead end into a login.
             */
            async onPasswordReset({ user: u }) {
                await options.services.db
                    .update(user)
                    .set({ emailVerified: true })
                    .where(eq(user.id, u.id));

                /**
                 * The reset just replaced a password nobody knew with one this
                 * member chose, so the placeholder marker no longer describes
                 * the row. Clearing it here rather than in a nightly job is
                 * what stops the "choose a TIHLDE password" banner from
                 * following them around after they already did.
                 */
                await options.services.db
                    .update(account)
                    .set({ passwordSource: null })
                    .where(
                        and(
                            eq(account.userId, u.id),
                            eq(account.providerId, "credential"),
                        ),
                    );
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
                 * never consults this flag — that path is governed by
                 * `requireLocalEmailVerified` below.
                 */
                allowDifferentEmails: true,

                /**
                 * Let a Feide login attach itself to an account whose address
                 * was never verified.
                 *
                 * Better Auth defaults this to true, and for good reason: an
                 * unverified row may have been planted by someone else, and
                 * linking would hand the victim an account carrying a stranger's
                 * password. Refusing to link is the cheap defence.
                 *
                 * It is also the wrong trade here. Registration demands a
                 * `@stud.ntnu.no` address, so a first-year student's only
                 * address on file is the NTNU mailbox they cannot open yet in
                 * August — which is where both the verification mail and the
                 * password reset go. The guard therefore strands exactly the
                 * people it cannot distinguish from an attacker, and every one
                 * of them becomes a manual ticket. 15 sat stuck during fadderuka
                 * 2026.
                 *
                 * The threat is answered instead by taking the password away
                 * rather than refusing the link — see the `account.create`
                 * database hook below and {@link revokeUnprovenCredentials}. A
                 * planted password is deleted by the very login that used to arm
                 * it, so the member gets in and the attacker gets nothing.
                 */
                requireLocalEmailVerified: false,
            },
        },

        /**
         * Runs on the row Better Auth is about to write for a Feide link.
         *
         * Deliberately `before` and not `after`: `create.after` hooks are queued
         * until the transaction settles, by which point the linking code has
         * already flipped `emailVerified` to true — and the revocation, which
         * keys off exactly that flag, would find nothing to do and silently
         * no-op. Running before the insert means the flag still reflects what
         * was proven *prior* to this login, which is the question being asked.
         */
        databaseHooks: {
            account: {
                create: {
                    before: async (data) => {
                        if (data.providerId !== "feide") return;
                        await revokeUnprovenCredentials(
                            options.services.db,
                            data.userId,
                        );
                    },
                },
            },

            /**
             * Every sign-in, whatever proved it. Unlike the Feide sync in
             * `hooks.after`, which can only run where a Feide token exists,
             * this reads nothing but our own tables — and the people it is for
             * are precisely the ones who have stopped being students and sign
             * in with a password.
             *
             * `after` and not `before`: the work belongs to no session row in
             * particular, and a failure must not cost anyone their login. So it
             * is logged and swallowed — the next sign-in tries again, and the
             * only thing lost meanwhile is a group membership.
             */
            session: {
                create: {
                    after: async (session) => {
                        try {
                            await syncDeEldstesRaad(
                                options.services.db,
                                session.userId,
                            );
                        } catch (error) {
                            console.error(
                                "Failed to sync De Eldstes Raad membership",
                                error,
                            );
                        }

                        /**
                         * The callback's own sync may have failed and left
                         * this member without a baseline role. Every new
                         * session is a chance to notice — see
                         * {@link recoverMissingBaselineRole}. Swallowed for
                         * the same reason as the sync above: a member who is
                         * already signed in must not be handed a 500.
                         */
                        try {
                            await recoverMissingBaselineRole(
                                options.services.db,
                                session.userId,
                            );
                        } catch (error) {
                            console.error(
                                "Failed to recover a missing baseline role",
                                error,
                            );
                        }
                    },
                },
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

                /**
                 * How the account gets its username:
                 *
                 * - Trusted caller naming one: used as-is. See
                 *   `runTrustedSignUp` for why this cannot come from the body.
                 * - Stud address: the local part, and only that. It is the
                 *   student's NTNU username, and a later Feide login finds the
                 *   account by it — so it is not the signer-upper's to choose.
                 * - Anything else (a private address, someone who is not a
                 *   student yet): the local part too, but they may name their
                 *   own instead. Local parts are not unique across providers,
                 *   so a collision has to have a way out, and the account has
                 *   no NTNU identity to protect anyway.
                 */
                const trusted = trustedSignUpStore.getStore();
                const studUsername = usernameFromStudentEmail(email);
                const chosenUsername = trusted
                    ? undefined
                    : normaliseUsername(ctx.body?.username);

                if (chosenUsername && !studUsername) {
                    if (
                        !SELF_CHOSEN_USERNAME_PATTERN.test(chosenUsername) ||
                        chosenUsername.length > 30
                    ) {
                        throw new APIError("BAD_REQUEST", {
                            message:
                                "Brukernavnet må være 3–30 tegn og kan bare inneholde små bokstaver, tall, punktum, bindestrek og understrek.",
                        });
                    }
                }

                const derivedUsername =
                    trusted?.username ??
                    studUsername ??
                    (chosenUsername || usernameFromEmailLocalPart(email));

                if (!derivedUsername) {
                    // Reachable two ways: a trusted caller passing a
                    // non-stud address with no username, and a private address
                    // whose local part is not a usable username (`a@b.no`,
                    // `ola+tihlde@…`). Only the second can happen over HTTP,
                    // and the answer to it is to name a username.
                    throw new APIError("BAD_REQUEST", {
                        message: trusted
                            ? "Registrering krever en @stud.ntnu.no-adresse."
                            : "Vi klarte ikke å lage et brukernavn fra e-postadressen din. Velg et selv.",
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
                            trusted || studUsername
                                ? "Det finnes allerede en bruker med dette NTNU-brukernavnet. Logg inn med Feide i stedet, eller bruk «glemt passord»."
                                : `Brukernavnet «${derivedUsername}» er opptatt. Velg et annet.`,
                    });
                }

                // For a stud address and for a trusted caller this is never the
                // body's to decide; for a private address the body is exactly
                // where a chosen username is allowed to come from.
                return {
                    context: {
                        body: { ...ctx.body, email, username: derivedUsername },
                    },
                };
            }),
            after: createAuthMiddleware(async (ctx) => {
                /**
                 * An account someone made for themselves on the website waits
                 * for an admin before it counts as a member.
                 *
                 * Written here rather than at creation time because the value
                 * depends on *how* the endpoint was called, and the sign-up
                 * body has no room for something the caller must not control.
                 * The row is found by e-mail: it is unique, the before-hook has
                 * already normalised it, and the account was created moments
                 * ago by this very request.
                 *
                 * Only ever fills in a status that is missing, so re-running it
                 * can never demote an approved member back to pending.
                 */
                if (
                    ctx.path === "/sign-up/email" &&
                    !trustedSignUpStore.getStore()
                ) {
                    const email = ctx.body?.email;
                    if (typeof email === "string" && email.length > 0) {
                        try {
                            const queued = await options.services.db
                                .update(user)
                                .set({ approvalStatus: "pending" })
                                .where(
                                    and(
                                        eq(
                                            user.email,
                                            email.trim().toLowerCase(),
                                        ),
                                        isNull(user.approvalStatus),
                                    ),
                                )
                                .returning({
                                    name: user.name,
                                    email: user.email,
                                    username: user.username,
                                });

                            /**
                             * Only on a real transition — `returning()` is
                             * empty when the status was already set, so a
                             * repeated sign-up cannot mail the queue twice for
                             * the same person.
                             */
                            if (queued[0]) {
                                await notifyApprovalQueue(
                                    options.services.email,
                                    options.urls.frontend,
                                    queued[0],
                                );
                            }
                        } catch (error) {
                            console.error(
                                "Failed to mark a self-registered account as awaiting approval:",
                                error,
                            );
                        }
                    }
                }

                if (!isFeideConfigured) return;

                // Sends a member whose password was just revoked on to set a
                // new one. Runs before the sync so a failing sync cannot cost
                // them the notice; own try for the same reason in reverse.
                try {
                    redirectToPasswordSetupAfterRevoke(
                        ctx,
                        options.urls.frontend,
                    );
                } catch (error) {
                    console.error(
                        "Failed to redirect to password setup after credential revoke:",
                        error,
                    );
                }

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

                /**
                 * The one list. Discovery advertises it, `/oauth2/authorize`
                 * validates against it, and a client with no stored scopes of
                 * its own inherits it — so the three cannot drift apart.
                 *
                 * Written out rather than left to the plugin default (which is
                 * the same four strings today) because the default is a moving
                 * target across releases: what a client may ask for is our
                 * contract with it, not the package's.
                 *
                 * `offline_access` is what buys a refresh token. Without it an
                 * access token dies after an hour with no way to renew, while
                 * the client's own session runs for months — see #644, where
                 * Proton lost its group memberships that way.
                 *
                 * A client narrows this only by storing its own `scopes`; that
                 * column is deliberately left NULL, since there is no UI to
                 * manage it and every client here is a TIHLDE app.
                 */
                scopes: ["openid", "profile", "email", "offline_access"],

                // Q9 decision: roles + groups embedded in JWT access tokens.
                // 15-minute staleness window is accepted; document it for admins.
                //
                // `get-session` is the only place that carries permissions, and
                // it reads the session cookie — an OAuth client holding a bearer
                // token has no way to reach it. The same strings therefore ride
                // along here, so those clients (the mobile app first) know what
                // the user may do without a second, cookie-bound call.
                //
                // Both hooks get them, because a client cannot count on either
                // one alone: an access token is only a JWT when the request
                // carries an audience, and is opaque otherwise. Userinfo works
                // in both cases and is what a client should read; the token
                // claims are for resource servers that already parse the JWT.
                //
                // Scoped permissions keep their scope suffix, so a client can
                // tell "may edit events in group:sosialen" from "may edit any
                // event" — same strings the API itself checks against.
                customAccessTokenClaims: async ({ user: u }) =>
                    u ? await permissionClaims(u.id) : {},
                customIdTokenClaims: ({ user: u }) => preferredUsernameClaim(u),
                customUserInfoClaims: async ({ user: u }) => ({
                    ...preferredUsernameClaim(u),
                    ...(u ? await permissionClaims(u.id) : {}),
                }),

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

                /**
                 * Three round-trips, and they were seven until we measured
                 * what this costs: every `get-session` runs this callback,
                 * cookie cache or not, because `customSession` only caches the
                 * session Better Auth itself reads. All of it stays live —
                 * caching the result would open exactly the stale-permission
                 * window the RBAC rollout depends on not existing (#354).
                 *
                 * `approvalStatus` rides along with the settings because it is
                 * ours, not part of Better Auth's user model: the session
                 * `user` handed to this callback carries only the columns it
                 * knows. The frontend needs it to tell a member from someone
                 * still waiting for an admin. Rooted at `user` rather than at
                 * the settings row, since not every account has settings.
                 */
                const [row, permissions, groups, accounts] = await Promise.all([
                    db.query.user.findFirst({
                        where: (u, { eq }) => eq(u.id, user.id),
                        columns: { approvalStatus: true },
                        with: {
                            settings: {
                                with: {
                                    allergies: {
                                        columns: { allergySlug: true },
                                    },
                                },
                            },
                            /**
                             * Only the timestamp, and no join to the programme:
                             * the question the frontend asks is "when did Feide
                             * last say anything about this member", which a
                             * login answers for every one of their programmes
                             * at once. Folded into this query rather than added
                             * as a fourth round-trip.
                             */
                            studyProgramMemberships: {
                                columns: { feideCheckedAt: true },
                            },
                        },
                    }),
                    getUserPermissions({ db }, user.id),
                    db.query.groupMembership.findMany({
                        where: (gm, { eq }) => eq(gm.userId, user.id),
                        with: { group: true },
                    }),
                    /**
                     * Which accounts back this login, so the frontend can tell
                     * "no TIHLDE password" from "a password nobody knows".
                     * They need different repairs — one sets a password, the
                     * other has to reset one — and the difference is invisible
                     * from the user table alone.
                     */
                    db.query.account.findMany({
                        where: (a, { eq }) => eq(a.userId, user.id),
                        columns: { providerId: true, passwordSource: true },
                    }),
                ]);

                const settings = row?.settings;
                const credential = accounts.find(
                    (a) => a.providerId === "credential",
                );

                /**
                 * When Feide last answered for this member, and whether asking
                 * again is even possible.
                 *
                 * A member with no Feide account is never nudged: they have
                 * nothing to sign in with, and the study they carry — from the
                 * Lepton migration or the fadderuka form — is the best we will
                 * ever have for them. Nudging them would be asking for
                 * something they cannot give.
                 */
                const feideCheckedAt = (row?.studyProgramMemberships ?? [])
                    .map((m) => m.feideCheckedAt)
                    .filter((at): at is Date => at != null)
                    .reduce<Date | null>(
                        (newest, at) =>
                            newest === null || at > newest ? at : newest,
                        null,
                    );
                const hasFeideAccount = accounts.some(
                    (a) => a.providerId === "feide",
                );

                return {
                    user: {
                        ...user,
                        approvalStatus: row?.approvalStatus ?? null,
                        isPendingApproval: row?.approvalStatus === "pending",
                        /**
                         * Three states, not two, and the prompt differs:
                         * `none` sets a password, `placeholder` has to reset
                         * one (the Lepton migration left a value nobody knows,
                         * and `/user/me/password` answers 409 while it is
                         * there), `chosen` needs nothing.
                         */
                        passwordState: !credential
                            ? ("none" as const)
                            : credential.passwordSource === "migrated"
                              ? ("placeholder" as const)
                              : ("chosen" as const),
                        settings: settings
                            ? {
                                  ...settings,
                                  allergies: settings.allergies.map(
                                      (a) => a.allergySlug,
                                  ),
                              }
                            : null,
                        /**
                         * Enough for the frontend to ask the member to sign in
                         * with Feide again when their enrolment answer has gone
                         * stale — see `isFeideCheckCurrent`. Never a claim that
                         * anything is wrong with them: an expired answer costs
                         * nobody their priority, it only means we last heard
                         * from Feide more than a semester ago.
                         */
                        feideCheckedAt: feideCheckedAt?.toISOString() ?? null,
                        needsFeideRefresh:
                            hasFeideAccount &&
                            !isFeideCheckCurrent(feideCheckedAt),
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
