import { validator } from "hono-openapi";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { createApiKeyResponseSchema, idParamSchema } from "./schemas";

export const regenerateRoute = route().post(
    "/:id/regenerate",
    describeAuthenticatedRoute({
        tags: ["api-keys"],
        summary: "Regenerate API key",
        operationId: "regenerateApiKey",
        description:
            "Generate a new key value for an existing API key. The old key will be invalidated. The new full key is returned only once and cannot be retrieved again. Requires 'api-keys:update' permission.",
    })
        .schemaResponse(
            200,
            createApiKeyResponseSchema,
            "API key regenerated successfully. The 'key' field contains the new API key and will not be shown again.",
        )
        .forbidden("Missing api-keys:update permission")
        .notFound("API key not found")
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
