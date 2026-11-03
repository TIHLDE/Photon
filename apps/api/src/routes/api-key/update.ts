import { validator } from "hono-openapi";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { assertHoldsApiKeyPermissions } from "~/lib/service/api-key";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { apiKeySchema, idParamSchema, updateApiKeySchema } from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Update API key",
        operationId: "updateApiKey",
        description:
            "Update an API key's metadata (name, description, permissions, metadata). Cannot update the key itself - use regenerate for that. Requires 'api-keys:update' permission, and to change permissions, every permission on the key before and after.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: apiKeySchema,
            description: "API key updated successfully",
        })
        .notFound({ description: "API key not found" })
        .forbidden({
            description: "Requires api-keys:update and the key's permissions",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "api-keys:update" }),
    validator("param", idParamSchema),
    validator("json", updateApiKeySchema),
    async (c) => {
        const body = c.req.valid("json");
        const { apiKey: service } = c.get("service");
        const { id } = c.req.valid("param");

        if (body.permissions) {
            const existing = await service.getById(id);
            if (!existing) {
                throw HTTPAppException.NotFound("API key not found");
            }

            // The admin page sends the list on every save, so a plain rename
            // arrives looking like this too.
            const held = new Set<string>(existing.permissions);
            const requested = new Set(body.permissions);
            const changed =
                held.size !== requested.size ||
                [...requested].some((p) => !held.has(p));
            if (changed) {
                await assertHoldsApiKeyPermissions(
                    c.get("ctx"),
                    c.get("user").id,
                    [...held, ...requested],
                );
            }
        }

        const updatedApiKey = await service.update(id, body);

        return c.json(updatedApiKey);
    },
);
