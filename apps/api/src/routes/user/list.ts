import { schema } from "@photon/db";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import {
    NO_STUDY_FILTER,
    userListQuerySchema,
    userListResponseSchema,
} from "./schema";

export const listUsersRoute = route().get(
    "/",
    describeRoute({
        tags: ["users"],
        summary: "List users",
        operationId: "listUsers",
        description:
            "Paginated list of every user, with optional name/username search and study filters. Used by the admin user overview. Requires 'users:view'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: userListResponseSchema,
            description: "Paginated users",
        })
        .forbidden({ description: "Requires users:view" })
        .build(),
    requireAuth,
    requireAccess({ permission: "users:view" }),
    validator("query", PaginationSchema.extend(userListQuerySchema.shape)),
    async (c) => {
        const { db } = c.get("ctx");
        const {
            page,
            pageSize,
            search,
            study,
            studyStartYear,
            approvalStatus,
        } = c.req.valid("query");

        /**
         * The member's *current* study programme, one row each.
         *
         * `DISTINCT ON` keeps the first row per member, so the ordering below
         * is the whole decision. It used to be `order by user_id, group.slug`,
         * which is deterministic and wrong: for a member who took Digital
         * forretningsutvikling and went on to the master, the alphabetically
         * first slug is the bachelor they left, so the list showed the old
         * study. That is the bug this endpoint was reported for.
         *
         * The order matches {@link deriveStudyFromGroups}, and has to: the
         * profile and this list showing different studies for the same person
         * is its own kind of wrong.
         *
         * The join to `study_program` is not decoration. `type = 'STUDY'` is
         * not proof of a study — `fondsforvalter` carries that type in
         * production without being one — and ranking on the join is what keeps
         * it from reading as somebody's degree. See
         * https://github.com/TIHLDE/Photon/issues/621.
         */
        const studyProgram = db
            .selectDistinctOn([schema.groupMembership.userId], {
                userId: schema.groupMembership.userId,
                slug: schema.group.slug,
                name: schema.group.name,
                // Named apart from the cohort subquery's `start_year`: both
                // are joined into the same select, and an unqualified
                // reference to a name they share is ambiguous in Postgres.
                programmeStartYear: sql<
                    number | null
                >`${schema.studyProgramMembership.startYear}`.as(
                    "programme_start_year",
                ),
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.group,
                eq(schema.group.slug, schema.groupMembership.groupSlug),
            )
            .leftJoin(
                schema.studyProgram,
                eq(schema.studyProgram.slug, schema.group.slug),
            )
            .leftJoin(
                schema.studyProgramMembership,
                and(
                    eq(
                        schema.studyProgramMembership.userId,
                        schema.groupMembership.userId,
                    ),
                    eq(
                        schema.studyProgramMembership.studyProgramId,
                        schema.studyProgram.id,
                    ),
                ),
            )
            .where(sql`lower(${schema.group.type}) = 'study'`)
            .orderBy(
                schema.groupMembership.userId,
                // A group backed by a real study programme beats one that is
                // not — `fondsforvalter` must never read as someone's degree,
                // but a study group added before its programme row exists
                // should still show rather than leaving the member blank.
                sql`(${schema.studyProgram.id} is not null) desc`,
                // Feide saying "enrolled" wins; "no answer" beats "not
                // enrolled", which is the only one of the three that is
                // evidence against.
                sql`(case when ${schema.studyProgramMembership.feideActive} then 2
                          when ${schema.studyProgramMembership.feideActive} is null then 1
                          else 0 end) desc`,
                sql`${schema.studyProgramMembership.startYear} desc nulls last`,
                sql`(${schema.studyProgram.type} = 'master') desc`,
                schema.studyProgram.slug,
            )
            .as("study_program");

        /**
         * The cohort year, used only when the current programme has no start
         * year of its own — which is the 1423 members who carry groups from
         * the Lepton migration and have no programme row at all.
         */
        const cohort = db
            .select({
                userId: schema.groupMembership.userId,
                startYear: sql<
                    number | null
                >`max(case when ${schema.group.name} ~ '^[0-9]{4}$' then ${schema.group.name}::int end)`.as(
                    "start_year",
                ),
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.group,
                eq(schema.group.slug, schema.groupMembership.groupSlug),
            )
            .where(sql`lower(${schema.group.type}) = 'studyyear'`)
            .groupBy(schema.groupMembership.userId)
            .as("cohort");

        /**
         * The baseline role the account holds, which is what decides whether
         * the member may register for events at all.
         *
         * `max` picks `member` over `alumni` on the account that somehow holds
         * both: the two are meant to be mutually exclusive, but if they are
         * not, the one that grants something is the one in effect, and the
         * admin should be shown what the checker will do.
         */
        const baselineRole = db
            .select({
                userId: schema.userRole.userId,
                name: sql<string>`max(${schema.role.name})`.as("baseline_role"),
            })
            .from(schema.userRole)
            .innerJoin(schema.role, eq(schema.role.id, schema.userRole.roleId))
            .where(inArray(schema.role.name, ["member", "alumni"]))
            .groupBy(schema.userRole.userId)
            .as("baseline_role");

        const where = and(
            search
                ? or(
                      ilike(schema.user.name, `%${search}%`),
                      ilike(schema.user.username, `%${search}%`),
                  )
                : undefined,
            study === NO_STUDY_FILTER
                ? isNull(studyProgram.slug)
                : study
                  ? eq(studyProgram.slug, study)
                  : undefined,
            studyStartYear === undefined
                ? undefined
                : eq(cohort.startYear, studyStartYear),
            approvalStatus
                ? eq(schema.user.approvalStatus, approvalStatus)
                : undefined,
        );

        const countRows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.user)
            .leftJoin(studyProgram, eq(studyProgram.userId, schema.user.id))
            .leftJoin(cohort, eq(cohort.userId, schema.user.id))
            .where(where);
        const totalCount = countRows[0]?.count ?? 0;

        const totalPages = getTotalPages(totalCount, pageSize);

        const rows = await db
            .select({
                id: schema.user.id,
                name: schema.user.name,
                username: schema.user.username,
                image: schema.user.image,
                banned: schema.user.banned,
                createdAt: schema.user.createdAt,
                studyProgram: studyProgram.name,
                // The current programme's own year, falling back to the cohort
                // group for the members who have no programme row at all.
                studyStartYear: sql<
                    number | null
                >`coalesce(${studyProgram.programmeStartYear}, ${cohort.startYear})`,
                approvalStatus: schema.user.approvalStatus,
                email: schema.user.email,
                baselineRole: sql<
                    "member" | "alumni" | null
                >`${baselineRole.name}`,
            })
            .from(schema.user)
            .leftJoin(studyProgram, eq(studyProgram.userId, schema.user.id))
            .leftJoin(cohort, eq(cohort.userId, schema.user.id))
            .leftJoin(baselineRole, eq(baselineRole.userId, schema.user.id))
            /**
             * The approval queue is a worklist, so it is ordered by how long
             * someone has been kept waiting. Everything else is a directory,
             * where alphabetical is what you want.
             */
            .orderBy(
                ...(approvalStatus === "pending"
                    ? [asc(schema.user.createdAt), asc(schema.user.id)]
                    : [asc(schema.user.name), asc(schema.user.id)]),
            )
            .limit(pageSize)
            .offset(getPageOffset(page, pageSize))
            .where(where);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items: rows.map(({ banned, ...row }) => ({
                ...row,
                // `banned` is nullable in Better Auth's schema; only an
                // explicit true means deactivated.
                isActive: banned !== true,
                createdAt: row.createdAt.toISOString(),
            })),
        } satisfies z.infer<typeof userListResponseSchema>);
    },
);
