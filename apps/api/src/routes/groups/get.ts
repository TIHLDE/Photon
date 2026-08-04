import { HTTPException } from "hono/http-exception";
import { assertGroupVisible } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
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
        .forbidden({
            description: "The group is private and you are not a member",
        })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const slug = c.req.param("slug");

        const group = await db.query.group.findFirst({
            where: (group, { eq }) => eq(group.slug, slug),
        });

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${slug}" not found`,
            });
        }

        await assertGroupVisible(ctx, group, c.get("user")?.id);

        return c.json(group);
    },
);
