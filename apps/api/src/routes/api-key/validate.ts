import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { validateApiKeyInputSchema, validateApiKeyResponseSchema } from "./schema";

export const validateRoute = route().post(
    "/validate",
    describeRoute({
        tags: ["api-keys"],
        summary: "Validate API key",
        operationId: "validateApiKey",
        description:
            "Check if an API key is valid and return its details. This is a public endpoint that does not require authentication. Updates the lastUsedAt timestamp if the key is valid.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: validateApiKeyResponseSchema,
            description:
                "Validation result. If valid=true, includes the API key details and permissions.",
        })
        .build(),
    validator("json", validateApiKeyInputSchema),
    async (c) => {
        const { key } = c.req.valid("json");
        const { apiKey: service } = c.get("service");

        const result = await service.validate(key);

        return c.json(result);
    },
);
