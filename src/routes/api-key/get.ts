import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
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
        .schemaResponse({
            statusCode: 200,
            schema: apiKeySchema,
            description: "API key details",
        })
        .notFound({ description: "API key not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:view" }),
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
