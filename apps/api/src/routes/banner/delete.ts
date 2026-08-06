import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteBannerResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["banners"],
        summary: "Delete banner",
        operationId: "deleteBanner",
        description:
            "Delete a banner. Requires 'banners:delete' or 'banners:manage', held globally or for any single group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteBannerResponseSchema,
            description: "Banner deleted successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Banner not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["banners:delete", "banners:manage"],
        anyGroupScope: true,
    }),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        const existing = await db.query.banner.findFirst({
            where: eq(schema.banner.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Banner not found" });
        }

        await db.delete(schema.banner).where(eq(schema.banner.id, id));

        return c.json({ message: "Banner deleted successfully" });
    },
);
