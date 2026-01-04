import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { idParamSchema } from "./schemas";

const deleteApiKeyResponseSchema = z.object({
    message: z.string().meta({ description: "Success message" }),
});

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Delete API key",
        operationId: "deleteApiKey",
        description:
            "Delete an API key. This action is irreversible. Requires 'api-keys:delete' permission.",
    })
        .schemaResponse(
            200,
            deleteApiKeyResponseSchema,
            "API key deleted successfully",
        )
        .notFound("API key not found")
        .build(),
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
