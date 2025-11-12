import { describeRoute, resolver, validator } from "hono-openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { idParamSchema } from "./schemas";
import z from "zod";

const deleteApiKeyResponseSchema = z.object({
    message: z.string().meta({ description: "Success message" }),
});

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Delete API key",
        description:
            "Delete an API key. This action is irreversible. Requires 'api-keys:delete' permission.",
        responses: {
            200: {
                description: "API key deleted successfully",
                content: {
                    "application/json": {
                        schema: resolver(deleteApiKeyResponseSchema),
                    },
                },
            },
            403: {
                description: "Forbidden - Missing api-keys:delete permission",
            },
            404: {
                description: "API key not found",
            },
        },
    }),
    requireAuth,
    requirePermission("api-keys:delete"),
    validator("param", idParamSchema),
    async (c) => {
        const { apiKey: service } = c.get("service");
        const { id } = c.req.valid("param");

        await service.delete(id);

        return c.json({ message: "API key deleted successfully" });
    },
);
