import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { assertGroupVisible } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    type UserStudy,
    deriveStudyFromGroups,
    loadStudyGroupRows,
} from "~/lib/user/study";
import { captureAuth } from "~/middleware/auth";
import { memberListSchema } from "../schema";

export const listMembersRoute = route().get(
    "/:groupSlug/members",
    describeRoute({
        tags: ["groups"],
        summary: "List group members",
        operationId: "listGroupMembers",
        description: "Retrieve a list of all members in a group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: memberListSchema,
            description: "List of members retrieved successfully",
        })
        .notFound({ description: "Group not found" })
        .forbidden({
            description: "The group is private and you are not a member",
        })
        .build(),
    captureAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");

        // Validate group exists
        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        await assertGroupVisible(ctx, group, c.get("user")?.id);

        // Get members with their public user info (name/image for display)
        const members = await db.query.groupMembership.findMany({
            where: eq(schema.groupMembership.groupSlug, groupSlug),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        username: true,
                        image: true,
                    },
                },
            },
        });

        /**
         * Study programme and cohort come from the group projection rather
         * than `studyProgramMembership`; see `deriveStudyFromGroups` for why.
         * Fetched for the whole page in one query, then grouped per member so
         * the derivation itself stays the shared one.
         */
        const userIds = members.map((m) => m.userId);
        const groupsByUser = await loadStudyGroupRows(c.get("ctx"), userIds);

        const studyByUser = new Map<string, UserStudy>();
        for (const [userId, groups] of groupsByUser) {
            studyByUser.set(userId, deriveStudyFromGroups(groups));
        }

        return c.json(
            members.map((member) => ({
                ...member,
                user: {
                    ...member.user,
                    studyProgram:
                        studyByUser.get(member.userId)?.studyProgram ?? null,
                    studyStartYear:
                        studyByUser.get(member.userId)?.studyStartYear ?? null,
                },
            })),
        );
    },
);
