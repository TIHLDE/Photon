import type { AuthSession, AuthUser } from "@photon/auth";
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

    const [user, settings] = await Promise.all([
        ctx.db.query.user.findFirst({
            where: eq(schema.user.id, verified.sub),
        }),
        ctx.db.query.userSettings.findFirst({
            where: eq(schema.userSettings.userId, verified.sub),
            with: { allergies: { columns: { allergySlug: true } } },
        }),
    ]);
    if (!user) return null;

    // Mirror the shape `customSession` builds, so bearer- and cookie-authenticated
    // requests see the same user object.
    return {
        user: {
            ...user,
            settings: settings
                ? {
                      ...settings,
                      allergies: settings.allergies.map((a) => a.allergySlug),
                  }
                : null,
        } as AuthUser,
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
 * Requires either a valid OAuth access token or a Better Auth session cookie.
 * OAuth tokens are verified locally against our JWKS, then hydrated to the
 * same user/session shape that cookie-authenticated requests receive.
 *
 * Accepts both kinds of JWTs we issue:
 *   - First-party JWTs from `/api/auth/token` (the web client)
 *   - OAuth access tokens from `/api/auth/oauth2/token` (third-party apps)
 *
 * Both use the same JWKS, the same audience, and the same issuer.
 */
export const requireAuth = describeMiddleware(
    createMiddleware<{ Variables: AuthVariables & { logger: LoggerType } }>(
        async (c, next) => {
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

            c.set("user", session.user);
            c.set("session", session.session);
            c.set("logger", c.get("logger").child({ userId: session.user.id }));

            await next();
        },
    ),
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
