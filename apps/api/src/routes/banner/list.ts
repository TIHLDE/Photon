import { schema } from "@photon/db";
import { desc } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { bannerListResponseSchema } from "./schema";
import { serializeBanner } from "./serialize";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["banners"],
        summary: "List all banners",
        operationId: "listBanners",
        description:
            "Every banner regardless of visibility window, for the admin panel. Requires 'banners:view' or 'banners:manage', held globally or for any single group. There are only ever a handful of banners, so the list is unpaginated.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: bannerListResponseSchema,
            description: "OK",
        })
        .forbidden({ description: "Insufficient permissions" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["banners:view", "banners:manage"],
        anyGroupScope: true,
    }),
    async (c) => {
        const { db } = c.get("ctx");

        const banners = await db.query.banner.findMany({
            orderBy: [desc(schema.banner.visibleFrom)],
        });

        const now = new Date();
        return c.json(
            banners.map((banner) => serializeBanner(banner, now)),
            200,
        );
    },
);
