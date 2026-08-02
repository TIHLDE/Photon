import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    STUDY_GROUP_TYPES,
    type UserStudy,
    deriveStudyFromGroups,
} from "~/lib/user/study";
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
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
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

        // Get members with their public user info (name/image for display)
        const members = await db.query.groupMembership.findMany({
            where: eq(schema.groupMembership.groupSlug, groupSlug),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
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
        const studyRows =
            userIds.length === 0
                ? []
                : await db
                      .select({
                          userId: schema.groupMembership.userId,
                          name: schema.group.name,
                          type: schema.group.type,
                      })
                      .from(schema.groupMembership)
                      .innerJoin(
                          schema.group,
                          eq(
                              schema.groupMembership.groupSlug,
                              schema.group.slug,
                          ),
                      )
                      .where(
                          and(
                              inArray(schema.groupMembership.userId, userIds),
                              inArray(sql`lower(${schema.group.type})`, [
                                  ...STUDY_GROUP_TYPES,
                              ]),
                          ),
                      );

        const groupsByUser = new Map<
            string,
            { name: string; type: string }[]
        >();
        for (const row of studyRows) {
            const entry = groupsByUser.get(row.userId) ?? [];
            entry.push({ name: row.name, type: row.type });
            groupsByUser.set(row.userId, entry);
        }

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
