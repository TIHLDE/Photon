import type { AuthUser } from "@photon/auth";
import { verifyJWTAccessToken } from "@photon/auth/oauth-verify";
import { createMiddleware } from "hono/factory";
import { getBearerTokenFromHeader, userFromClaims } from "~/lib/auth";
import type { AppContext, AppServices } from "~/lib/ctx";
import { HTTPAppException } from "~/lib/errors";
import { describeMiddleware, describeMiddlewareRoute } from "~/lib/openapi";
import type { ApiKey } from "~/lib/service/api-key";

type AuthOrApiKeyVariables = {
    user?: AuthUser;
    apiKey?: ApiKey;
    /** Set when the request was authenticated via an OAuth access token. */
    oauthClient?: { clientId: string; scopes: string[] };
    ctx: AppContext;
    service: AppServices;
};

/**
 * Middleware that requires one of:
 * - A valid OAuth access token (see `verifyJWTAccessToken`)
 * - A valid Photon API key (`Authorization: Bearer photon_...`)
 * - A Better Auth session cookie
 *
 * On success, exactly one of `user`+(optionally `oauthClient`) or `apiKey`
 * will be set on the context. If none succeeds, 401.
 */
export const requireAuthOrApiKey = describeMiddleware(
    createMiddleware<{ Variables: AuthOrApiKeyVariables }>(async (c, next) => {
        const { auth } = c.get("ctx");
        const token = getBearerTokenFromHeader(c.req.header("Authorization"));

        // 1. OAuth access token.
        const verified = await verifyJWTAccessToken(auth, token ?? undefined);
        if (verified) {
            c.set("user", userFromClaims(verified.sub, verified.payload));
            if (verified.clientId) {
                c.set("oauthClient", {
                    clientId: verified.clientId,
                    scopes: verified.scopes,
                });
            }
            await next();
            return;
        }

        // 2. Photon API key.
        if (token) {
            const apiKeyService = c.get("service").apiKey;
            const result = await apiKeyService.validate(token);

            if (result.valid && result.apiKey) {
                c.set("apiKey", result.apiKey);
                await next();
                return;
            }
        }

        // 3. Better Auth session cookie. The web client authenticates with
        // cookies only — without this it could never reach these routes.
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });
        if (session) {
            c.set("user", session.user as AuthUser);
            await next();
            return;
        }

        throw HTTPAppException.Unauthorized("Authentication required");
    }),
    describeMiddlewareRoute()
        .errorResponses([HTTPAppException.Unauthorized()])
        .getSpec(),
);
