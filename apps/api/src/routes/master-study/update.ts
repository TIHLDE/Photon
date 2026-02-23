import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

const masterStudyQuoteSchema = z.object({
    name: z.string().min(1).max(200),
    quote: z.string().min(1),
});

const updateMasterStudySchema = z.object({
    studyProgramId: z.number().int().positive().optional(),
    name: z.string().min(1).max(300).optional(),
    location: z.string().min(1).max(300).optional(),
    locationType: z.enum(["innland", "utland"]).optional(),
    hasFinancialSupport: z.boolean().optional(),
    financialSupport: z.string().optional().nullable(),
    subjectRequirements: z.string().optional().nullable(),
    otherRequirements: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    applicationDeadline: z.string().datetime().optional().nullable(),
    quotes: z.array(masterStudyQuoteSchema).optional(),
});

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["master-study"],
        summary: "Update master study entry",
        operationId: "updateMasterStudyEntry",
        description:
            "Update a master study entry. Requires 'master_study:update' or 'master_study:manage' permission (admins and Beta).",
    })
        .response({
            statusCode: 200,
            description: "Master study entry updated successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Master study entry not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["master_study:update", "master_study:manage"] }),
    validator("json", updateMasterStudySchema),
    async (c) => {
        const body = c.req.valid("json");
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        const existing = await db.query.masterStudyEntry.findFirst({
            where: eq(schema.masterStudyEntry.id, id),
        });

        if (!existing) {
            throw new HTTPException(404, {
                message: "Master study entry not found",
            });
        }

        const { quotes, applicationDeadline, ...restBody } = body;
        const updateData: Partial<typeof schema.masterStudyEntry.$inferInsert> =
            {};

        if (restBody.studyProgramId !== undefined) {
            updateData.studyProgramId = restBody.studyProgramId;
        }
        if (restBody.name !== undefined) {
            updateData.name = restBody.name;
        }
        if (restBody.location !== undefined) {
            updateData.location = restBody.location;
        }
        if (restBody.locationType !== undefined) {
            updateData.locationType = restBody.locationType;
        }
        if (restBody.hasFinancialSupport !== undefined) {
            updateData.hasFinancialSupport = restBody.hasFinancialSupport;
        }
        if (restBody.financialSupport !== undefined) {
            updateData.financialSupport = restBody.financialSupport ?? null;
        }
        if (restBody.subjectRequirements !== undefined) {
            updateData.subjectRequirements = restBody.subjectRequirements ?? null;
        }
        if (restBody.otherRequirements !== undefined) {
            updateData.otherRequirements = restBody.otherRequirements ?? null;
        }
        if (restBody.summary !== undefined) {
            updateData.summary = restBody.summary ?? null;
        }
        if (applicationDeadline !== undefined) {
            updateData.applicationDeadline = applicationDeadline
                ? new Date(applicationDeadline)
                : null;
        }

        let updatedEntry = existing;

        if (Object.keys(updateData).length > 0) {
            const [result] = await db
                .update(schema.masterStudyEntry)
                .set(updateData)
                .where(eq(schema.masterStudyEntry.id, id))
                .returning();
            if (result) updatedEntry = result;
        }

        if (!updatedEntry) {
            throw new HTTPException(404, {
                message: "Master study entry not found",
            });
        }

        if (quotes !== undefined) {
            await db
                .delete(schema.masterStudyQuote)
                .where(eq(schema.masterStudyQuote.entryId, id));

            if (quotes.length > 0) {
                await db.insert(schema.masterStudyQuote).values(
                    quotes.map((q) => ({
                        entryId: id,
                        name: q.name,
                        quote: q.quote,
                    })),
                );
            }
        }

        const entry = await db.query.masterStudyEntry.findFirst({
            where: eq(schema.masterStudyEntry.id, id),
            with: {
                studyProgram: true,
                quotes: true,
            },
        });

        if (!entry) {
            return c.json(updatedEntry);
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
