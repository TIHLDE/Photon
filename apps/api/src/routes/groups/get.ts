import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { groupSchema } from "./schema";

export const getRoute = route().get(
    "/:slug",
    describeRoute({
        tags: ["groups"],
        summary: "Get group by slug",
        operationId: "getGroup",
        description:
            "Retrieve detailed information about a specific group by its slug identifier.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: groupSchema,
            description: "Group details retrieved successfully",
        })
        .notFound({
            description: "Group with the specified slug does not exist",
        })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
        const slug = c.req.param("slug");

        const group = await db.query.group.findFirst({
            where: (group, { eq }) => eq(group.slug, slug),
        });

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        return c.json(group);
    },
);
