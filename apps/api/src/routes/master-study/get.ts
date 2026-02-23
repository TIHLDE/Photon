import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";

export const getRoute = route().get(
    "/:id",
    describeRoute({
        tags: ["master-study"],
        summary: "Get master study entry",
        operationId: "getMasterStudyEntry",
        description: "Get a single master study entry by ID. Public endpoint.",
    })
        .response({ statusCode: 200, description: "Master study entry details" })
        .notFound({ description: "Master study entry not found" })
        .build(),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        const entry = await db.query.masterStudyEntry.findFirst({
            where: eq(schema.masterStudyEntry.id, id),
            with: {
                studyProgram: true,
                quotes: true,
            },
        });

        if (!entry) {
            throw new HTTPException(404, {
                message: "Master study entry not found",
            });
        }

        const response = {
            id: entry.id,
            studyProgramId: entry.studyProgramId,
            studyProgram: entry.studyProgram
                ? {
                      id: entry.studyProgram.id,
                      slug: entry.studyProgram.slug,
                      displayName: entry.studyProgram.displayName,
                      type: entry.studyProgram.type,
                  }
                : null,
            name: entry.name,
            location: entry.location,
            locationType: entry.locationType,
            hasFinancialSupport: entry.hasFinancialSupport,
            financialSupport: entry.financialSupport ?? null,
            subjectRequirements: entry.subjectRequirements ?? null,
            otherRequirements: entry.otherRequirements ?? null,
            summary: entry.summary ?? null,
            applicationDeadline: entry.applicationDeadline?.toISOString() ?? null,
            quotes: entry.quotes.map((q) => ({
                id: q.id,
                name: q.name,
                quote: q.quote,
            })),
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
        };

        return c.json(response);
    },
);
