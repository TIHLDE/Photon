import { schema } from "@photon/db";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
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
         * Study programme and cohort mirror the group-member list: they are a
         * projection of Feide onto ordinary groups (types STUDY/STUDYYEAR),
         * not `studyProgramMembership` — that table only gets rows from a
         * Feide login, so everyone migrated from Lepton is missing there. The
         * type is stored in UPPERCASE from Lepton, hence the lower() compare.
         */
        const studyProgram = db
            .selectDistinctOn([schema.groupMembership.userId], {
                userId: schema.groupMembership.userId,
                slug: schema.group.slug,
                name: schema.group.name,
            })
            .from(schema.groupMembership)
            .innerJoin(
                schema.group,
                eq(schema.group.slug, schema.groupMembership.groupSlug),
            )
            .where(sql`lower(${schema.group.type}) = 'study'`)
            .orderBy(schema.groupMembership.userId, schema.group.slug)
            .as("study_program");

        // Several cohorts can linger on one account (a bachelor who continued
        // into a master). The most recent one is the useful one.
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
                studyStartYear: cohort.startYear,
                approvalStatus: schema.user.approvalStatus,
                email: schema.user.email,
            })
            .from(schema.user)
            .leftJoin(studyProgram, eq(studyProgram.userId, schema.user.id))
            .leftJoin(cohort, eq(cohort.userId, schema.user.id))
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
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items: rows.map(({ banned, email, ...row }) => ({
                ...row,
                // `banned` is nullable in Better Auth's schema; only an
                // explicit true means deactivated.
                isActive: banned !== true,
                // An admin deciding on a stranger has nothing else to go on —
                // no study programme, no Feide, just the address they typed.
                // Everyone else's address stays out of a list this broad.
                email: row.approvalStatus === "pending" ? email : null,
                createdAt: row.createdAt.toISOString(),
            })),
        } satisfies z.infer<typeof userListResponseSchema>);
    },
);
