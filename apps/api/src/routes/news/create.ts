import { schema } from "@photon/db";
import { validator } from "hono-openapi";
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
            "Create a new news article. Requires 'news:create' permission.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: newsArticleSchema,
            description: "News article created successfully",
        })
        .build(),
    requireAuth,
    requireAccess({ permission: "news:create" }),
    validator("json", createNewsSchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        const [newNews] = await db
            .insert(schema.news)
            .values({
                ...body,
                createdById: userId,
            })
            .returning();

        return c.json(newNews, 201);
    },
);
