import { describeRoute, validator } from "hono-openapi";
import z from "zod";
import { route } from "~/lib/route";

const validateApiKeySchema = z.object({
    key: z.string().min(1).meta({ description: "The API key to validate" }),
});

export const validateRoute = route().post(
    "/validate",
    describeRoute({
        tags: ["api-keys"],
        summary: "Validate API key",
        description:
            "Check if an API key is valid and return its details. This is a public endpoint that does not require authentication. Updates the lastUsedAt timestamp if the key is valid.",
        responses: {
            200: {
                description:
                    "Validation result. If valid=true, includes the API key details and permissions.",
            },
        },
    }),
    validator("json", validateApiKeySchema),
    async (c) => {
        const { key } = c.req.valid("json");
        const { apiKey: service } = c.get("service");

        const result = await service.validate(key);

        return c.json(result);
    },
);
