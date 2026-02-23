import z from "zod";
import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

const masterStudyQuoteSchema = z.object({
    name: z.string().min(1).max(200).meta({ description: "Name of the person quoted" }),
    quote: z.string().min(1).meta({ description: "The quote text" }),
});

export const createMasterStudySchema = z.object({
    studyProgramId: z
        .number()
        .int()
        .positive()
        .meta({ description: "ID of the study program from org.studyProgram" }),
    name: z.string().min(1).max(300).meta({ description: "Navn" }),
    location: z.string().min(1).max(300).meta({ description: "Sted" }),
    locationType: z
        .enum(["innland", "utland"])
        .meta({ description: "Innland or utland for filtering" }),
    hasFinancialSupport: z
        .boolean()
        .default(false)
        .meta({ description: "Økonomisk støtte tilgjengelig? (Ja/Nei)" }),
    financialSupport: z.string().optional().meta({ description: "Økonomisk støtte - detaljer/beskrivelse" }),
    subjectRequirements: z.string().optional().meta({ description: "Fagkrav" }),
    otherRequirements: z.string().optional().meta({ description: "Øvrige krav" }),
    summary: z.string().optional().meta({ description: "Oppsummering / skriv" }),
    applicationDeadline: z
        .string()
        .datetime()
        .optional()
        .meta({ description: "Søknadsfrist" }),
    quotes: z
        .array(masterStudyQuoteSchema)
        .optional()
        .default([])
        .meta({ description: "Quotes from others (name and quote)" }),
});

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["master-study"],
        summary: "Create master study entry",
        operationId: "createMasterStudy",
        description:
            "Create a new master study entry. Requires 'master_study:create' permission.",
    })
        .response({
            statusCode: 201,
            description: "Master study entry created successfully",
        })
        .badRequest({ description: "Invalid input" })
        .build(),
    requireAuth,
    requireAccess({ permission: "master_study:create" }),
    validator("json", createMasterStudySchema),
    async (c) => {
        const body = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        const [newMasterStudyEntry] = await db
            .insert(schema.masterStudyEntry)
            .values({
                studyProgramId: body.studyProgramId,
                name: body.name,
                location: body.location,
                locationType: body.locationType,
                hasFinancialSupport: body.hasFinancialSupport,
                financialSupport: body.financialSupport ?? null,
                subjectRequirements: body.subjectRequirements ?? null,
                otherRequirements: body.otherRequirements ?? null,
                summary: body.summary ?? null,
                applicationDeadline: body.applicationDeadline
                    ? new Date(body.applicationDeadline)
                    : null,
                createdById: userId,
            })
            .returning();

        if (newMasterStudyEntry && body.quotes.length > 0) {
            await db.insert(schema.masterStudyQuote).values(
                body.quotes.map((q) => ({
                    entryId: newMasterStudyEntry.id,
                    name: q.name,
                    quote: q.quote,
                })),
            );
        }

        return c.json(newMasterStudyEntry, 201);
    },
);
