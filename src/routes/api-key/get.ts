import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
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
    })
        .schemaResponse(200, apiKeySchema, "API key details")
        .notFound("API key not found")
        .build(),
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
