import { describeRoute, resolver, validator } from "hono-openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { createApiKeyResponseSchema, idParamSchema } from "./schemas";

export const regenerateRoute = route().post(
    "/:id/regenerate",
    describeRoute({
        tags: ["api-keys"],
        summary: "Regenerate API key",
        description:
            "Generate a new key value for an existing API key. The old key will be invalidated. The new full key is returned only once and cannot be retrieved again. Requires 'api-keys:update' permission.",
        responses: {
            200: {
                description:
                    "API key regenerated successfully. The 'key' field contains the new API key and will not be shown again.",
                content: {
                    "application/json": {
                        schema: resolver(createApiKeyResponseSchema),
                    },
                },
            },
            403: {
                description: "Forbidden - Missing api-keys:update permission",
            },
            404: {
                description: "API key not found",
            },
        },
    }),
    requireAuth,
    requirePermission("api-keys:update"),
    validator("param", idParamSchema),
    async (c) => {
        const { apiKey: service } = c.get("service");
        const { id } = c.req.valid("param");

        const regeneratedApiKey = await service.regenerate(id);

        return c.json(regeneratedApiKey);
    },
);
