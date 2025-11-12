import { describeRoute } from "hono-openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["api-keys"],
        summary: "Delete API key",
        description:
            "Delete an API key. This action is irreversible. Requires 'api-keys:delete' permission.",
        responses: {
            200: {
                description: "API key deleted successfully",
            },
            403: {
                description: "Forbidden - Missing api-keys:delete permission",
            },
        },
    }),
    requireAuth,
    requirePermission("api-keys:delete"),
    async (c) => {
        const { apiKey: service } = c.get("service");
        const { id } = c.req.param();

        await service.delete(id);

        return c.json({ message: "API key deleted successfully" });
    },
);
