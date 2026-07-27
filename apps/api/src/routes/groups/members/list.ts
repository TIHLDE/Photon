import { schema } from "@photon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
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
         * Study programme and cohort are a projection of Feide onto ordinary
         * groups (types STUDY/STUDYYEAR), so they come from the same
         * membership table rather than `studyProgramMembership` — the latter
         * is only ever written by a Feide login, which leaves everyone
         * migrated from Lepton without a row. The type is stored in UPPERCASE
         * from Lepton, so compare case-insensitively.
         */
        const userIds = members.map((m) => m.userId);
        const studyRows =
            userIds.length === 0
                ? []
                : await db
                      .select({
                          userId: schema.groupMembership.userId,
                          groupName: schema.group.name,
                          groupType:
                              sql<string>`lower(${schema.group.type})`.as(
                                  "group_type",
                              ),
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
                                  "study",
                                  "studyyear",
                              ]),
                          ),
                      );

        const studyByUser = new Map<
            string,
            { studyProgram: string | null; studyStartYear: number | null }
        >();
        for (const row of studyRows) {
            const entry = studyByUser.get(row.userId) ?? {
                studyProgram: null,
                studyStartYear: null,
            };
            if (row.groupType === "study") {
                entry.studyProgram ??= row.groupName;
            } else {
                // Several cohorts can linger on one account (a bachelor who
                // continued into a master). The most recent one is the useful
                // one — it is what class year is computed from.
                const year = Number.parseInt(row.groupName, 10);
                if (
                    Number.isFinite(year) &&
                    (entry.studyStartYear === null ||
                        year > entry.studyStartYear)
                ) {
                    entry.studyStartYear = year;
                }
            }
            studyByUser.set(row.userId, entry);
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
