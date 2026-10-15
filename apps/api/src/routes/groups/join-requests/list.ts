import { schema } from "@photon/db";
import { and, asc, eq } from "drizzle-orm";
import { computeClassStanding } from "~/lib/event/priority";
import { isGroupLeader } from "~/lib/group/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { deriveStudyFromGroups, loadStudyGroupRows } from "~/lib/user/study";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { pendingJoinRequestListSchema } from "./schema";

export const listJoinRequestsRoute = route().get(
    "/:groupSlug/join-requests",
    describeRoute({
        tags: ["groups"],
        summary: "List pending join requests",
        operationId: "listGroupJoinRequests",
        description:
            "The group's pending join requests, oldest first. Requires being the group's leader, or 'groups:manage' (globally or scoped to the group).",
    })
        .schemaResponse({
            statusCode: 200,
            schema: pendingJoinRequestListSchema,
            description: "Pending join requests",
        })
        .build(),
    requireAuth,
    requireAccess({
        permission: "groups:manage",
        scope: (c) => `group:${c.req.param("groupSlug")}`,
        ownership: { param: "groupSlug", check: isGroupLeader },
    }),
    async (c) => {
        const ctx = c.get("ctx");
        const requests = await ctx.db.query.groupJoinRequest.findMany({
            where: and(
                eq(schema.groupJoinRequest.groupSlug, c.req.param("groupSlug")),
                eq(schema.groupJoinRequest.status, "pending"),
            ),
            orderBy: asc(schema.groupJoinRequest.createdAt),
            columns: { id: true, name: true, message: true, createdAt: true },
            with: {
                user: { columns: { id: true, email: true } },
            },
        });

        const studyByUser = await loadStudyGroupRows(
            ctx,
            requests.map((r) => r.user.id),
        );

        return c.json(
            requests.map((request) => {
                const rows = studyByUser.get(request.user.id) ?? [];
                return {
                    ...request,
                    user: {
                        ...request.user,
                        studyProgram: deriveStudyFromGroups(rows).studyProgram,
                        classYear: computeClassStanding(rows).classYear,
                    },
                };
            }),
            200,
        );
    },
);
