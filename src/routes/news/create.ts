import { validator } from "hono-openapi";
import z from "zod";
import { schema } from "~/db";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { requirePermission } from "~/middleware/permission";

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
    describeAuthenticatedRoute({
        tags: ["news"],
        summary: "Create news article",
        operationId: "createNews",
        description:
            "Create a new news article. Requires 'news:create' permission.",
    })
        .response(201, "News article created successfully")
        .forbidden("Missing news:create permission")
        .build(),
    requireAuth,
    requirePermission("news:create"),
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
