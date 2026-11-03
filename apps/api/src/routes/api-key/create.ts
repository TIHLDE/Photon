import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { assertHoldsApiKeyPermissions } from "~/lib/service/api-key";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createApiKeyResponseSchema, createApiKeySchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["api-keys"],
        summary: "Create API key",
        operationId: "createApiKey",
        description:
            "Create a new API key. The full key is returned only once and cannot be retrieved again. Requires 'api-keys:create' permission, and every permission on the key.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createApiKeyResponseSchema,
            description:
                "API key created successfully. The 'key' field contains the full API key and will not be shown again.",
        })
        .forbidden({
            description: "Requires api-keys:create and the key's permissions",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:create" }),
    validator("json", createApiKeySchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { apiKey: service } = c.get("service");

        await assertHoldsApiKeyPermissions(
            c.get("ctx"),
            userId,
            body.permissions,
        );

        const newApiKey = await service.create({
            ...body,
            createdById: userId,
        });

        return c.json(newApiKey, 201);
    },
);
