import { describeRoute, resolver } from "hono-openapi";
import z from "zod";
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
        description:
            "Get a list of all API keys. Does not include the full key values. Requires 'api-keys:view' permission.",
        responses: {
            200: {
                description: "List of API keys",
                content: {
                    "application/json": {
                        schema: resolver(listApiKeysResponseSchema),
                    },
                },
            },
            403: {
                description: "Forbidden - Missing api-keys:view permission",
            },
        },
    }),
    requireAuth,
    requirePermission("api-keys:view"),
    async (c) => {
        const { apiKey: service } = c.get("service");

        const apiKeys = await service.list();

        return c.json(apiKeys);
    },
);
