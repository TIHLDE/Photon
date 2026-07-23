import { schema } from "@photon/db";
import { ilike, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { Schema, describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

export const userSearchResultSchema = Schema(
    "UserSearchResult",
    z.array(
        z.object({
            id: z.string(),
            name: z.string().nullable(),
            username: z.string().nullable(),
            image: z.string().nullable(),
        }),
    ),
);

export const searchUsersRoute = route().get(
    "/search",
    describeRoute({
        tags: ["users"],
        summary: "Search users",
        operationId: "searchUsers",
        description:
            "Search users by name or username (case-insensitive substring). Used by admin UIs to assign roles and positions. Requires 'users:view' or 'roles:assign'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userSearchResultSchema,
            description: "Matching users",
        })
        .forbidden({ description: "Requires users:view or roles:assign" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["users:view", "roles:assign"] }),
    validator(
        "query",
        z.object({
            q: z
                .string()
                .min(2)
                .max(100)
                .meta({ description: "Search term (name or username)" }),
        }),
    ),
    async (c) => {
        const { db } = c.get("ctx");
        const { q } = c.req.valid("query");

        const pattern = `%${q.trim()}%`;
        const users = await db
            .select({
                id: schema.user.id,
                name: schema.user.name,
                username: schema.user.username,
                image: schema.user.image,
            })
            .from(schema.user)
            .where(
                or(
                    ilike(schema.user.name, pattern),
                    ilike(schema.user.username, pattern),
                ),
            )
            .orderBy(schema.user.name)
            .limit(10);

        return c.json(users);
    },
);
