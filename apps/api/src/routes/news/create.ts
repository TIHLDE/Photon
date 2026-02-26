import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

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

const createNewsResponseSchema = z.object({
    id: z.uuid().meta({ description: "News article ID" }),
    title: z.string().meta({ description: "News article title" }),
    header: z.string().meta({ description: "News article subtitle/ingress" }),
    body: z.string().meta({ description: "Main content" }),
    imageUrl: z.string().nullable().meta({ description: "Image URL" }),
    imageAlt: z.string().nullable().meta({ description: "Image alt text" }),
    emojisAllowed: z
        .boolean()
        .meta({ description: "Whether reactions are enabled" }),
    createdById: z.string().nullable().meta({ description: "Creator user ID" }),
    createdAt: z.string().meta({ description: "Creation time (ISO 8601)" }),
    updatedAt: z.string().meta({ description: "Last update time (ISO 8601)" }),
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
        .schemaResponse({
            statusCode: 201,
            schema: createNewsResponseSchema,
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
