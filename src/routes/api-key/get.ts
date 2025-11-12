import { describeRoute } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Get API key",
        description:
            "Get a single API key by ID. Does not include the full key value. Requires 'api-keys:view' permission.",
        responses: {
            200: {
                description: "API key details",
            },
            404: {
                description: "API key not found",
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
        const { id } = c.req.param();

        const apiKey = await service.getById(id);

        if (!apiKey) {
            throw new HTTPException(404, {
                message: "API key not found",
            });
        }

        return c.json(apiKey);
    },
);
