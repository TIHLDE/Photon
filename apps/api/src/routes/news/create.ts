import { requireAccess, requireAuth } from "@photon/auth/server";
import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

const createNewsSchema = z.object({
    title: z
        .string()
        .min(1)
        .max(200)
        .meta({ description: "News article title" }),
    header: z
        .string()
        .min(1)
        .max(200)
        .meta({ description: "News article subtitle/ingress" }),
    body: z.string().min(1).meta({ description: "Main content of the news" }),
    imageUrl: z
        .string()
        .url()
        .optional()
        .meta({ description: "Optional image URL" }),
    imageAlt: z
        .string()
        .max(255)
        .optional()
        .meta({ description: "Alt text for the image" }),
    emojisAllowed: z
        .boolean()
        .default(false)
        .meta({ description: "Whether reactions are enabled" }),
});

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["news"],
        summary: "Create news article",
        operationId: "createNews",
        description:
            "Create a new news article. Requires 'news:create' permission.",
    })
        .response({
            statusCode: 201,
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
