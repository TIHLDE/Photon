import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { bannerSchema, createBannerSchema } from "./schema";
import { serializeBanner } from "./serialize";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["banners"],
        summary: "Create banner",
        operationId: "createBanner",
        description:
            "Create a new front-page banner. Requires 'banners:create' or 'banners:manage', held globally or for any single group.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: bannerSchema,
            description: "Banner created successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["banners:create", "banners:manage"],
        anyGroupScope: true,
    }),
    validator("json", createBannerSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        const [newBanner] = await db
            .insert(schema.banner)
            .values({
                title: body.title,
                description: body.description,
                url: body.url,
                linkText: body.linkText,
                visibleFrom: new Date(body.visibleFrom),
                visibleUntil: new Date(body.visibleUntil),
                createdById: userId,
            })
            .returning();

        if (!newBanner) {
            throw new Error("Failed to create banner");
        }

        return c.json(serializeBanner(newBanner), 201);
    },
);
