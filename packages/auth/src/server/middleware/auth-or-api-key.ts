import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { parseBearerOptional } from "../bearer";
import type { AuthInstance, Session, User } from "../index";
import type { ApiKeyLike, ApiKeyServiceLike } from "./api-key";

type AuthOrApiKeyVariables = {
    user?: User;
    session?: Session;
    apiKey?: ApiKeyLike;
    ctx: { auth: AuthInstance; [key: string]: unknown };
    service: { apiKey: ApiKeyServiceLike; [key: string]: unknown };
};

/**
 * Middleware that requires either:
 * - A valid session (user authentication), OR
 * - A valid API key via Authorization header
 *
 * If session auth succeeds, `user` and `session` will be available.
 * If API key auth succeeds, `apiKey` will be available.
 * If neither succeeds, a 401 Unauthorized error is thrown.
 *
 * Expected API key format: `Authorization: Bearer photon_...`
 */
export const requireAuthOrApiKey = createMiddleware<{
    Variables: AuthOrApiKeyVariables;
}>(async (c, next) => {
    const { auth } = c.get("ctx");

    // Try session auth first
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (session) {
        c.set("user", session.user);
        c.set("session", session.session);
        await next();
        return;
    }

    // Try API key auth
    const token = parseBearerOptional(c.req.header("Authorization"));

    if (token) {
        const apiKeyService = c.get("service").apiKey;
        const result = await apiKeyService.validate(token);

        if (result.valid && result.apiKey) {
            c.set("apiKey", result.apiKey);
            await next();
            return;
        }
    }

    throw new HTTPException(401, {
        message: "Authentication required",
    });
});
