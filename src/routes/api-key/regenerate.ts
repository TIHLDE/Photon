import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { createApiKeyResponseSchema, idParamSchema } from "./schemas";

export const regenerateRoute = route().post(
    "/:id/regenerate",
    describeRoute({
        tags: ["api-keys"],
        summary: "Regenerate API key",
        operationId: "regenerateApiKey",
        description:
            "Generate a new key value for an existing API key. The old key will be invalidated. The new full key is returned only once and cannot be retrieved again. Requires 'api-keys:update' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: createApiKeyResponseSchema,
            description:
                "API key regenerated successfully. The 'key' field contains the new API key and will not be shown again.",
        })
        .notFound({ description: "API key not found" })
        .build(),
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
