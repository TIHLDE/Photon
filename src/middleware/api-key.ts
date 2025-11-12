import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { ApiKey } from "~/lib/service/api-key";
import type { AppContext, AppServices } from "../lib/ctx";

type ApiKeyVariables = {
    apiKey: ApiKey;
    ctx: AppContext;
    service: AppServices;
};

/**
 * Requires that a valid API key is provided via the Authorization header.
 * The API key will be made available to the route handler via `c.get("apiKey")`.
 *
 * Expected format: `Authorization: Bearer photon_...`
 */
export const requireApiKey = createMiddleware<{ Variables: ApiKeyVariables }>(
    async (c, next) => {
        const authHeader = c.req.header("Authorization");

        if (!authHeader) {
            throw new HTTPException(401, {
                message: "API key required. Provide via Authorization header.",
            });
        }

        // Extract token from "Bearer <token>" format
        const parts = authHeader.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
            throw new HTTPException(401, {
                message:
                    'Invalid Authorization header format. Expected "Bearer <api-key>"',
            });
        }

        const key = parts[1];

        // Validate the API key
        const apiKeyService = c.get("service").apiKey;
        const result = await apiKeyService.validate(key);

        if (!result.valid || !result.apiKey) {
            throw new HTTPException(401, {
                message: "Invalid or expired API key",
            });
        }

        c.set("apiKey", result.apiKey);

        await next();
    },
);

/**
 * Does not require an API key, but if a valid one is provided,
 * it will be made available to the route handler via `c.get("apiKey")`.
 *
 * Expected format: `Authorization: Bearer photon_...`
 */
export const captureApiKey = createMiddleware<{
    Variables: Partial<ApiKeyVariables> & {
        ctx: AppContext;
        service: AppServices;
    };
}>(async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
        await next();
        return;
    }

    // Extract token from "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        await next();
        return;
    }

    const key = parts[1];

    // Validate the API key
    const apiKeyService = c.get("service").apiKey;
    const result = await apiKeyService.validate(key);

    if (result.valid && result.apiKey) {
        c.set("apiKey", result.apiKey);
    }

    await next();
});
