import { HTTPException } from "hono/http-exception";
import { assertGroupVisible } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import { isFinesEligibleMember } from "./fines/permissions";
import { groupDetailSchema } from "./schema";

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
            schema: groupDetailSchema,
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

        const userId = c.get("user")?.id;
        await assertGroupVisible(ctx, group, userId);

        /**
         * Answered here rather than left to the client: the botsjef keeps
         * access whatever the roster says, and in a study group an ordinary
         * member only counts while Feide still reports them enrolled. Neither
         * rule is derivable from the fields above.
         */
        const viewerCanUseFines = Boolean(
            group.finesActivated &&
            userId &&
            (group.finesAdminId === userId ||
                (await isFinesEligibleMember(ctx, userId, group))),
        );

        return c.json({ ...group, viewerCanUseFines });
    },
);
