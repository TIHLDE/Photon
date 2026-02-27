import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { apiKeySchema, idParamSchema, updateApiKeySchema } from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Update API key",
        operationId: "updateApiKey",
        description:
            "Update an API key's metadata (name, description, permissions, metadata). Cannot update the key itself - use regenerate for that. Requires 'api-keys:update' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: apiKeySchema,
            description: "API key updated successfully",
        })
        .notFound({ description: "API key not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:update" }),
    validator("param", idParamSchema),
    validator("json", updateApiKeySchema),
    async (c) => {
        const body = c.req.valid("json");
        const { apiKey: service } = c.get("service");
        const { id } = c.req.valid("param");

        const updatedApiKey = await service.update(id, body);

        return c.json(updatedApiKey);
    },
);
