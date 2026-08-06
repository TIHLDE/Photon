import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { bannerSchema, updateBannerSchema } from "./schema";
import { serializeBanner } from "./serialize";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["banners"],
        summary: "Update banner",
        operationId: "updateBanner",
        description:
            "Update a banner. Requires 'banners:update' or 'banners:manage', held globally or for any single group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: bannerSchema,
            description: "Banner updated successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Banner not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["banners:update", "banners:manage"],
        anyGroupScope: true,
    }),
    validator("json", updateBannerSchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        const existing = await db.query.banner.findFirst({
            where: eq(schema.banner.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, { message: "Banner not found" });
        }

        const visibleFrom = body.visibleFrom
            ? new Date(body.visibleFrom)
            : existing.visibleFrom;
        const visibleUntil = body.visibleUntil
            ? new Date(body.visibleUntil)
            : existing.visibleUntil;

        if (visibleFrom.getTime() >= visibleUntil.getTime()) {
            throw new HTTPException(400, {
                message: "visibleFrom must be before visibleUntil",
            });
        }

        const [updatedBanner] = await db
            .update(schema.banner)
            .set({
                title: body.title,
                description: body.description,
                url: body.url,
                linkText: body.linkText,
                visibleFrom: body.visibleFrom ? visibleFrom : undefined,
                visibleUntil: body.visibleUntil ? visibleUntil : undefined,
            })
            .where(eq(schema.banner.id, id))
            .returning();

        if (!updatedBanner) {
            throw new HTTPException(404, { message: "Banner not found" });
        }

        return c.json(serializeBanner(updatedBanner), 200);
    },
);
