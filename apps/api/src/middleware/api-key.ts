import { parseBearer, parseBearerOptional } from "@photon/auth/bearer";
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
        const result = parseBearer(c.req.header("Authorization"));

        if (!result.success) {
            throw new HTTPException(401, {
                message: result.error,
            });
        }

        // Validate the API key
        const apiKeyService = c.get("service").apiKey;
        const validation = await apiKeyService.validate(result.token);

        if (!validation.valid || !validation.apiKey) {
            throw new HTTPException(401, {
                message: "Invalid or expired API key",
            });
        }

        c.set("apiKey", validation.apiKey);

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
    const token = parseBearerOptional(c.req.header("Authorization"));

    if (!token) {
        await next();
        return;
    }

    // Validate the API key
    const apiKeyService = c.get("service").apiKey;
    const result = await apiKeyService.validate(token);

    if (result.valid && result.apiKey) {
        c.set("apiKey", result.apiKey);
    }

    await next();
});
