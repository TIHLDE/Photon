import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";
import { apiKeySchema } from "./schemas";

export const listApiKeysResponseSchema = z.array(apiKeySchema);

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["api-keys"],
        summary: "List API keys",
        operationId: "listApiKeys",
        description:
            "Get a list of all API keys. Does not include the full key values. Requires 'api-keys:view' permission.",
    })
        .schemaResponse(200, listApiKeysResponseSchema, "List of API keys")
        .build(),
    requireAuth,
    requirePermission("api-keys:view"),
    async (c) => {
        const { apiKey: service } = c.get("service");

        const apiKeys = await service.list();

        return c.json(apiKeys);
    },
);
