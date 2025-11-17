import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { apiKeySchema, idParamSchema } from "./schemas";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Get API key",
        operationId: "getApiKey",
        description:
            "Get a single API key by ID. Does not include the full key value. Requires 'api-keys:view' permission.",
        responses: {
            200: {
                description: "API key details",
                content: {
                    "application/json": {
                        schema: resolver(apiKeySchema),
                    },
                },
            },
            404: {
                description: "API key not found",
            },
            403: {
                description: "Forbidden - Missing api-keys:view permission",
            },
        },
    }),
    requireAuth,
    requirePermission("api-keys:view"),
    validator("param", idParamSchema),
    async (c) => {
        const { apiKey: service } = c.get("service");
        const { id } = c.req.valid("param");

        const apiKey = await service.getById(id);

        if (!apiKey) {
            throw new HTTPException(404, {
                message: "API key not found",
            });
        }

        return c.json(apiKey);
    },
);
