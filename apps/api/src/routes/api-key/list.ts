import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { listApiKeysResponseSchema } from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["api-keys"],
        summary: "List API keys",
        operationId: "listApiKeys",
        description:
            "Get a list of all API keys. Does not include the full key values. Requires 'api-keys:view' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: listApiKeysResponseSchema,
            description: "List of API keys",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:view" }),
    async (c) => {
        const { apiKey: service } = c.get("service");

        const apiKeys = await service.list();

        return c.json(apiKeys);
    },
);
