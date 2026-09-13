import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { promoteAssetUrls } from "~/lib/asset";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createNewsSchema, newsArticleSchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["news"],
        summary: "Create news article",
        operationId: "createNews",
        description:
            "Create a new news article. Requires 'news:create' or 'news:manage', held globally or for any single group.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: newsArticleSchema,
            description: "News article created successfully",
        })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["news:create", "news:manage"],
        anyGroupScope: true,
    }),
    validator("json", createNewsSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db, bucket } = c.get("ctx");

        const [newNews] = await db
            .insert(schema.news)
            .values({
                ...body,
                createdById: userId,
            })
            .returning();

        // Etter lagringen: se promoteAssetUrls for hvorfor rekkefølgen teller.
        await promoteAssetUrls(bucket, [body.imageUrl]);

        return c.json(newNews, 201);
    },
);
