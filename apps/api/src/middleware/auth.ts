import type { AuthSession, AuthUser } from "@photon/auth";
import { isFeideCheckCurrent } from "@photon/auth/feide";
import {
    type VerifiedAccessToken,
    verifyJWTAccessToken,
} from "@photon/auth/oauth-verify";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { describeMiddleware, describeMiddlewareRoute } from "~/lib/openapi";
import type { AppContext } from "../lib/ctx";

import { HTTPAppException } from "~/lib/errors";
import type { LoggerType } from "./logger";
import { getBearerTokenFromHeader, userFromClaims } from "~/lib/auth";

type AuthVariables = {
    user: AuthUser;
    session?: AuthSession;
    /** Set when the request was authenticated via an OAuth access token. */
    oauthClient?: { clientId: string; scopes: string[] };
    ctx: AppContext;
};

async function sessionFromVerifiedToken(
    ctx: AppContext,
    verified: VerifiedAccessToken,
): Promise<{ user: AuthUser; session: AuthSession } | null> {
    if (!verified.sessionId) return null;

    const session = await ctx.db.query.session.findFirst({
        where: eq(schema.session.id, verified.sessionId),
    });
    if (!session || session.userId !== verified.sub) return null;
    if (session.expiresAt <= new Date()) return null;

    const [user, settings, accounts, programmes] = await Promise.all([
        ctx.db.query.user.findFirst({
            where: eq(schema.user.id, verified.sub),
        }),
        ctx.db.query.userSettings.findFirst({
            where: eq(schema.userSettings.userId, verified.sub),
            with: { allergies: { columns: { allergySlug: true } } },
        }),
        ctx.db.query.account.findMany({
            where: eq(schema.account.userId, verified.sub),
            columns: { providerId: true, passwordSource: true },
        }),
        ctx.db.query.studyProgramMembership.findMany({
            where: eq(schema.studyProgramMembership.userId, verified.sub),
            columns: { feideCheckedAt: true },
        }),
    ]);
    if (!user) return null;

    const credential = accounts.find((a) => a.providerId === "credential");
    const feideCheckedAt = programmes
        .map((p) => p.feideCheckedAt)
        .filter((at): at is Date => at != null)
        .reduce<Date | null>(
            (newest, at) => (newest === null || at > newest ? at : newest),
            null,
        );

    // Mirror the shape `customSession` builds, so bearer- and cookie-authenticated
    // requests see the same user object. `approvedAt`/`approvedBy` are left out
    // for that reason: they are an admin's audit trail, not something a session
    // has any use for, and the cookie path does not carry them.
    const { approvedAt: _approvedAt, approvedBy: _approvedBy, ...rest } = user;
    return {
        user: {
            ...rest,
            settings: settings
                ? {
                      ...settings,
                      allergies: settings.allergies.map((a) => a.allergySlug),
                  }
                : null,
            // `customSession` computes these rather than storing them, so a
            // bearer-authenticated request has to compute them too.
            isPendingApproval: user.approvalStatus === "pending",
            passwordState: !credential
                ? "none"
                : credential.passwordSource === "migrated"
                  ? "placeholder"
                  : "chosen",
            feideCheckedAt: feideCheckedAt?.toISOString() ?? null,
            // Same three conditions as `customSession`; see the note there for
            // why a member with no programme row is left alone.
            needsFeideRefresh:
                accounts.some((a) => a.providerId === "feide") &&
                programmes.length > 0 &&
                !isFeideCheckCurrent(feideCheckedAt),
        } as unknown as AuthUser,
        session: session as AuthSession,
    };
}

function setVerifiedOAuthClient(
    c: {
        set: (
            key: "oauthClient",
            value: { clientId: string; scopes: string[] },
        ) => void;
    },
    verified: VerifiedAccessToken,
) {
    if (verified.clientId) {
        c.set("oauthClient", {
            clientId: verified.clientId,
            scopes: verified.scopes,
        });
    }
}

/**
 * Turn away an account that is still waiting for an admin to approve it.
 *
 * Anyone can sign themselves up with a private address, so authentication on
 * its own no longer says the caller belongs here. Rather than teaching every
 * route the difference, the rule sits in `requireAuth`: signing in gets you
 * your own account and nothing else until someone approves you. Routes a
 * pending user genuinely needs — their own settings, their password, linking
 * Feide — opt out with `requireAuthAllowPending`.
 *
 * Public pages are unaffected: they use `captureAuth`, which never calls this.
 */
function assertApproved(user: AuthUser): void {
    const status = (user as { approvalStatus?: string | null }).approvalStatus;
    if (status === "pending") {
        throw HTTPAppException.Forbidden(
            "Kontoen din venter på godkjenning fra en administrator.",
        );
    }
}

/**
 * Requires either a valid OAuth access token or a Better Auth session cookie.
 * OAuth tokens are verified locally against our JWKS, then hydrated to the
 * same user/session shape that cookie-authenticated requests receive.
 *
 * Accepts both kinds of JWTs we issue:
 *   - First-party JWTs from `/api/auth/token` (the web client)
 *   - OAuth access tokens from `/api/auth/oauth2/token` (third-party apps)
 *
 * Both use the same JWKS, the same audience, and the same issuer.
 *
 * `allowPendingApproval` lets an account that has not been approved yet
 * through — only for the handful of routes that exist to serve exactly that
 * person, such as their own settings.
 */
const authMiddleware = (options: { allowPendingApproval: boolean }) =>
    createMiddleware<{ Variables: AuthVariables & { logger: LoggerType } }>(
        async (c, next) => {
            const guard = (user: AuthUser) => {
                if (!options.allowPendingApproval) assertApproved(user);
            };
            const { auth } = c.get("ctx");
            const bearer = getBearerTokenFromHeader(
                c.req.header("Authorization"),
            );
            const verified = await verifyJWTAccessToken(
                auth,
                bearer ?? undefined,
            );
            if (verified) {
                const hydrated = await sessionFromVerifiedToken(
                    c.get("ctx"),
                    verified,
                );
                if (hydrated) {
                    guard(hydrated.user);
                    c.set("user", hydrated.user);
                    c.set("session", hydrated.session);
                    setVerifiedOAuthClient(c, verified);
                    c.set(
                        "logger",
                        c.get("logger").child({
                            userId: verified.sub,
                            ...(verified.clientId
                                ? { oauthClientId: verified.clientId }
                                : {}),
                        }),
                    );

                    await next();
                    return;
                }

                if (!verified.sessionId) {
                    c.set(
                        "user",
                        userFromClaims(verified.sub, verified.payload),
                    );
                    setVerifiedOAuthClient(c, verified);
                    c.set(
                        "logger",
                        c.get("logger").child({
                            userId: verified.sub,
                            ...(verified.clientId
                                ? { oauthClientId: verified.clientId }
                                : {}),
                        }),
                    );

                    await next();
                    return;
                }
            }

            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (!session) throw HTTPAppException.Unauthorized();

            guard(session.user as AuthUser);
            c.set("user", session.user);
            c.set("session", session.session);
            c.set("logger", c.get("logger").child({ userId: session.user.id }));

            await next();
        },
    );

export const requireAuth = describeMiddleware(
    authMiddleware({ allowPendingApproval: false }),
    describeMiddlewareRoute()
        .errorResponses([
            HTTPAppException.Unauthorized(),
            HTTPAppException.Forbidden(
                "Kontoen din venter på godkjenning fra en administrator.",
            ),
        ])
        .getSpec(),
);

/**
 * `requireAuth`, minus the approval requirement.
 *
 * For routes that serve the signed-in person themselves — settings, password,
 * onboarding, linking a Feide account. Locking someone out of those while they
 * wait would leave them with an account they cannot even finish setting up.
 */
export const requireAuthAllowPending = describeMiddleware(
    authMiddleware({ allowPendingApproval: true }),
    describeMiddlewareRoute()
        .errorResponses([HTTPAppException.Unauthorized()])
        .getSpec(),
);

/**
 * Does not require the request to be authenticated, but if a valid bearer
 * JWT is present, populates `user` (and `oauthClient` when applicable).
 */
export const captureAuth = createMiddleware<{
    Variables: Partial<AuthVariables> & { ctx: AppContext } & {
        logger: LoggerType;
    };
}>(async (c, next) => {
    const { auth } = c.get("ctx");
    const bearer = getBearerTokenFromHeader(c.req.header("Authorization"));
    const verified = await verifyJWTAccessToken(auth, bearer ?? undefined);
    if (verified) {
        const hydrated = await sessionFromVerifiedToken(c.get("ctx"), verified);
        if (hydrated) {
            c.set("user", hydrated.user);
            c.set("session", hydrated.session);
            setVerifiedOAuthClient(c, verified);
            c.set("logger", c.get("logger").child({ userId: verified.sub }));

            await next();
            return;
        }

        if (!verified.sessionId) {
            c.set("user", userFromClaims(verified.sub, verified.payload));
            setVerifiedOAuthClient(c, verified);
            c.set("logger", c.get("logger").child({ userId: verified.sub }));

            await next();
            return;
        }
    }

    if (!verified || verified.sessionId) {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });
        if (session) {
            c.set("user", session.user);
            c.set("session", session.session);
            c.set("logger", c.get("logger").child({ userId: session.user.id }));
        }

        await next();
        return;
    }
});
