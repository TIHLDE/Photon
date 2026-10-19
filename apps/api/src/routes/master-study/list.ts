import { schema } from "@photon/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import type z from "zod";
import {
    masterStudyEntryWith,
    toMasterStudyEntryResponse,
} from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    getNextPage,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import {
    masterStudyListFilterSchema,
    masterStudyListResponseSchema,
} from "./schema";

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["master-study"],
        summary: "List master study entries",
        operationId: "listMasterStudyEntries",
        description:
            "Paged list of master study entries, most recently updated first. Supports search and filtering by location type, study program and financial support. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyListResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", masterStudyListFilterSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const {
            page,
            pageSize,
            search,
            locationType,
            studyProgramId,
            hasFinancialSupport,
        } = c.req.valid("query");

        const conditions = and(
            search
                ? or(
                      ilike(schema.masterStudyEntry.name, `%${search}%`),
                      ilike(schema.masterStudyEntry.location, `%${search}%`),
                      ilike(schema.masterStudyEntry.summary, `%${search}%`),
                  )
                : undefined,
            locationType
                ? eq(schema.masterStudyEntry.locationType, locationType)
                : undefined,
            studyProgramId !== undefined
                ? eq(schema.masterStudyEntry.studyProgramId, studyProgramId)
                : undefined,
            hasFinancialSupport !== undefined
                ? eq(
                      schema.masterStudyEntry.hasFinancialSupport,
                      hasFinancialSupport,
                  )
                : undefined,
        );

        const totalCount = await db.$count(schema.masterStudyEntry, conditions);
        const totalPages = getTotalPages(totalCount, pageSize);

        const entries = await db.query.masterStudyEntry.findMany({
            where: conditions,
            with: masterStudyEntryWith,
            orderBy: [
                desc(schema.masterStudyEntry.updatedAt),
                desc(schema.masterStudyEntry.id),
            ],
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
        });

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: getNextPage(page, totalPages),
            items: entries.map(toMasterStudyEntryResponse),
        } satisfies z.infer<typeof masterStudyListResponseSchema>);
    },
);
