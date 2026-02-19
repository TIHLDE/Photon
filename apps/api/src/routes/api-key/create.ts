import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createApiKeyResponseSchema } from "./schemas";

const createApiKeySchema = z.object({
    name: z
        .string()
        .min(1)
        .max(100)
        .meta({ description: "Name for the API key" }),
    description: z
        .string()
        .min(1)
        .max(500)
        .meta({ description: "Detailed description of the API key's purpose" }),
    permissions: z.array(z.string()).min(1).meta({
        description:
            "Array of permissions granted to this API key (e.g., ['email:send', 'news:create']). Service validates against allowed permissions.",
    }),
    metadata: z
        .record(z.string(), z.unknown())
        .optional()
        .meta({ description: "Optional metadata as key-value pairs" }),
});

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["api-keys"],
        summary: "Create API key",
        operationId: "createApiKey",
        description:
            "Create a new API key. The full key is returned only once and cannot be retrieved again. Requires 'api-keys:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createApiKeyResponseSchema,
            description:
                "API key created successfully. The 'key' field contains the full API key and will not be shown again.",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:create" }),
    validator("json", createApiKeySchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { apiKey: service } = c.get("service");

        const newApiKey = await service.create({
            ...body,
            createdById: userId,
        });

        return c.json(newApiKey, 201);
    },
);
