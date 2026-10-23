import { HTTPException } from "hono/http-exception";
import { HTTPAppException } from "~/lib/errors";
import { getGroup, isGroupMember, removeUserFromGroup } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";

export const leaveGroupRoute = route().post(
    "/:groupSlug/leave",
    describeRoute({
        tags: ["groups"],
        summary: "Leave a group",
        operationId: "leaveGroup",
        description:
            "Remove yourself from an interest group. Other groups are left by asking their leader. Any verv held in the group goes with the membership, and the stint is kept in the group's history.",
    })
        .response({
            statusCode: 204,
            description: "Left the group",
        })
        .badRequest({ description: "The group is not an interest group" })
        .notFound({ description: "Not a member of the group" })
        .build(),
    requireAuth,
    async (c) => {
        const groupSlug = c.req.param("groupSlug");
        const userId = c.get("user").id;
        const ctx = c.get("ctx");

        const group = await getGroup(ctx, groupSlug);
        if (group && group.type.toLowerCase() !== "interestgroup") {
            throw HTTPAppException.BadRequest(
                "Bare interessegrupper kan forlates på egen hånd. Kontakt lederen for å gå ut av denne gruppen.",
            );
        }

        if (!(await isGroupMember(ctx, userId, groupSlug))) {
            throw new HTTPException(404, {
                message: `You are not a member of group "${groupSlug}"`,
            });
        }

        await removeUserFromGroup(ctx, userId, groupSlug);

        return c.body(null, 204);
    },
);
