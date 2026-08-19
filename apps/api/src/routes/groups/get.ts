import { HTTPException } from "hono/http-exception";
import { assertGroupVisible } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import { isFinesEligibleMember, wasEverGroupMember } from "./fines/permissions";
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

        /**
         * The read-only half of the same question, for someone who has left:
         * they no longer take part in the group's bøter, but the ones already
         * in their name — given and received — stay theirs to look up. Without
         * this the client has nothing to hang that view on, since every other
         * field here says "not a member".
         */
        const viewerCanSeeOwnFines = Boolean(
            group.finesActivated &&
            userId &&
            !viewerCanUseFines &&
            (await wasEverGroupMember(ctx, userId, group.slug)),
        );

        return c.json({ ...group, viewerCanUseFines, viewerCanSeeOwnFines });
    },
);
