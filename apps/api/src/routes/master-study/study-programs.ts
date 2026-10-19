import { schema } from "@photon/db";
import { asc, count, eq } from "drizzle-orm";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { masterStudyProgramListSchema } from "./schema";

export const studyProgramsRoute = route().get(
    "/study-programs",
    describeRoute({
        tags: ["master-study"],
        summary: "List study programs for master study",
        operationId: "listMasterStudyPrograms",
        description:
            "Every study program an entry can be linked to, with how many entries each has. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyProgramListSchema,
            description: "OK",
        })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");

        const programs = await db
            .select({
                id: schema.studyProgram.id,
                slug: schema.studyProgram.slug,
                displayName: schema.studyProgram.displayName,
                type: schema.studyProgram.type,
                entryCount: count(schema.masterStudyEntry.id),
            })
            .from(schema.studyProgram)
            .leftJoin(
                schema.masterStudyEntry,
                eq(
                    schema.masterStudyEntry.studyProgramId,
                    schema.studyProgram.id,
                ),
            )
            .groupBy(schema.studyProgram.id)
            .orderBy(asc(schema.studyProgram.displayName));

        return c.json(programs);
    },
);
