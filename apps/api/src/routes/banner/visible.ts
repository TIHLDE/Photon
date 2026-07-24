import { schema } from "@photon/db";
import { and, desc, gt, lte } from "drizzle-orm";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    type visibleBannerSchema,
    visibleBannerListResponseSchema,
} from "./schema";

export const visibleRoute = route().get(
    "/visible",
    describeRoute({
        tags: ["banners"],
        summary: "List currently visible banners",
        operationId: "listVisibleBanners",
        description:
            "Banners whose visibility window covers the current moment, newest first. Public endpoint — this is what the front page renders.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: visibleBannerListResponseSchema,
            description: "OK",
        })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
        const now = new Date();

        const banners = await db.query.banner.findMany({
            where: and(
                lte(schema.banner.visibleFrom, now),
                gt(schema.banner.visibleUntil, now),
            ),
            orderBy: [desc(schema.banner.visibleFrom)],
        });

        const items = banners.map((banner) => ({
            id: banner.id,
            title: banner.title,
            description: banner.description,
            url: banner.url ?? null,
            linkText: banner.linkText ?? null,
            visibleUntil: banner.visibleUntil.toISOString(),
        })) satisfies z.infer<typeof visibleBannerSchema>[];

        return c.json(items, 200);
    },
);
