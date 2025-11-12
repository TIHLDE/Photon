import { describeRoute, validator } from "hono-openapi";
import z from "zod";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

const updateApiKeySchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).max(500).optional(),
    permissions: z.array(z.string()).min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Update API key",
        description:
            "Update an API key's metadata (name, description, permissions, metadata). Cannot update the key itself - use regenerate for that. Requires 'api-keys:update' permission.",
        responses: {
            200: {
                description: "API key updated successfully",
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
    validator("json", updateApiKeySchema),
    async (c) => {
        const body = c.req.valid("json");
        const { apiKey: service } = c.get("service");
        const { id } = c.req.param();

        const updatedApiKey = await service.update(id, body);

        return c.json(updatedApiKey);
    },
);
