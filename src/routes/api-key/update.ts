import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { apiKeySchema, idParamSchema } from "./schemas";

const updateApiKeySchema = z.object({
    name: z
        .string()
        .min(1)
        .max(100)
        .optional()
        .meta({ description: "Name for the API key" }),
    description: z
        .string()
        .min(1)
        .max(500)
        .optional()
        .meta({ description: "Detailed description of the API key's purpose" }),
    permissions: z
        .array(z.string())
        .min(1)
        .optional()
        .meta({ description: "Array of permissions granted to this API key" }),
    metadata: z
        .record(z.string(), z.unknown())
        .optional()
        .meta({ description: "Optional metadata as key-value pairs" }),
});

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Update API key",
        operationId: "updateApiKey",
        description:
            "Update an API key's metadata (name, description, permissions, metadata). Cannot update the key itself - use regenerate for that. Requires 'api-keys:update' permission.",
    })
        .schemaResponse(200, apiKeySchema, "API key updated successfully")
        .notFound("API key not found")
        .build(),
    requireAuth,
    requirePermission("api-keys:update"),
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
