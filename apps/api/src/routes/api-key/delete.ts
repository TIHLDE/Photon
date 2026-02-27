import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteApiKeyResponseSchema, idParamSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Delete API key",
        operationId: "deleteApiKey",
        description:
            "Delete an API key. This action is irreversible. Requires 'api-keys:delete' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteApiKeyResponseSchema,
            description: "API key deleted successfully",
        })
        .notFound({ description: "API key not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:delete" }),
    validator("param", idParamSchema),
    async (c) => {
        const { apiKey: service } = c.get("service");
        const { id } = c.req.valid("param");

        await service.delete(id);

        return c.json({ message: "API key deleted successfully" });
    },
);
