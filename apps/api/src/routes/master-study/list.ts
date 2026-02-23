import { schema } from "@photon/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    PaginationSchema,
    PagniationResponseSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";

const masterStudyQuoteSchema = z.object({
    id: z.uuid({ version: "v4" }).meta({ description: "Quote ID" }),
    name: z.string().meta({ description: "Name of the person quoted" }),
    quote: z.string().meta({ description: "The quote text" }),
});

const masterStudyEntrySchema = z.object({
    id: z.uuid({ version: "v4" }).meta({ description: "Entry ID" }),
    studyProgramId: z.number().meta({ description: "Study program ID" }),
    studyProgram: z
        .object({
            id: z.number().meta({ description: "Study program ID" }),
            slug: z.string().meta({ description: "Study program slug" }),
            displayName: z.string().meta({ description: "Study program name" }),
            type: z.string().meta({ description: "bachelor or master" }),
        })
        .nullable()
        .meta({ description: "Study program details" }),
    name: z.string().meta({ description: "Navn" }),
    location: z.string().meta({ description: "Sted" }),
    locationType: z.enum(["innland", "utland"]).meta({ description: "Innland or utland" }),
    hasFinancialSupport: z.boolean().meta({ description: "Økonomisk støtte tilgjengelig? (Ja/Nei)" }),
    financialSupport: z.string().nullable().meta({ description: "Økonomisk støtte - detaljer" }),
    subjectRequirements: z.string().nullable().meta({ description: "Fagkrav" }),
    otherRequirements: z.string().nullable().meta({ description: "Øvrige krav" }),
    summary: z.string().nullable().meta({ description: "Oppsummering / skriv" }),
    applicationDeadline: z.iso
        .date()
        .nullable()
        .meta({ description: "Søknadsfrist (ISO 8601)" }),
    quotes: z
        .array(masterStudyQuoteSchema)
        .meta({ description: "Quotes from others" }),
    createdAt: z.iso.date().meta({ description: "Creation time (ISO 8601)" }),
    updatedAt: z.iso.date().meta({ description: "Sist oppdatert (ISO 8601)" }),
});

const filterSchema = PaginationSchema.extend({
    search: z.string().optional().meta({
        description: "Search term to filter by name, location or summary",
    }),
    locationType: z.enum(["innland", "utland"]).optional().meta({
        description: "Filter by innland or utland",
    }),
    studyProgramId: z.coerce.number().int().positive().optional().meta({
        description: "Filter by study program ID",
    }),
    hasFinancialSupport: z.coerce.boolean().optional().meta({
        description: "Filter by whether financial support is available",
    }),
});

const ResponseSchema = PagniationResponseSchema.extend({
    items: z.array(masterStudyEntrySchema).describe("List of master study entries"),
});

export const listRoute = route().get(
    "/",
    describeRoute({
        tags: ["master-study"],
        summary: "List master study entries",
        operationId: "listMasterStudyEntries",
        description:
            "Get a paginated list of master study entries. Supports search, location type (innland/utland) and study program filtering. Public endpoint.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: ResponseSchema,
            description: "OK",
        })
        .build(),
    validator("query", filterSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { page, pageSize, search, locationType, studyProgramId, hasFinancialSupport } =
            c.req.valid("query");

        const conditions = and(
            ...[
                hasFinancialSupport != null
                    ? eq(schema.masterStudyEntry.hasFinancialSupport, hasFinancialSupport)
                    : undefined,
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
                studyProgramId != null
                    ? eq(schema.masterStudyEntry.studyProgramId, studyProgramId)
                    : undefined,
            ].filter(Boolean),
        );

        const entryCount = await db.$count(schema.masterStudyEntry, conditions);

        const pageOffset = getPageOffset(page, pageSize);
        const totalPages = getTotalPages(entryCount, pageSize);

        const entries = await db.query.masterStudyEntry.findMany({
            where: conditions ?? undefined,
            with: {
                studyProgram: true,
                quotes: true,
            },
            orderBy: [desc(schema.masterStudyEntry.updatedAt)],
            limit: pageSize,
            offset: pageOffset,
        });

        const items = entries.map((e) => ({
            id: e.id,
            studyProgramId: e.studyProgramId,
            studyProgram: e.studyProgram
                ? {
                      id: e.studyProgram.id,
                      slug: e.studyProgram.slug,
                      displayName: e.studyProgram.displayName,
                      type: e.studyProgram.type,
                  }
                : null,
            name: e.name,
            location: e.location,
            locationType: e.locationType as "innland" | "utland",
            hasFinancialSupport: e.hasFinancialSupport,
            financialSupport: e.financialSupport ?? null,
            subjectRequirements: e.subjectRequirements ?? null,
            otherRequirements: e.otherRequirements ?? null,
            summary: e.summary ?? null,
            applicationDeadline: e.applicationDeadline?.toISOString() ?? null,
            quotes: e.quotes.map((q) => ({
                id: q.id,
                name: q.name,
                quote: q.quote,
            })),
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
        })) satisfies z.infer<typeof masterStudyEntrySchema>[];

        return c.json({
            totalCount: entryCount,
            pages: totalPages,
            nextPage: page + 1 >= totalPages ? null : page + 1,
            items,
        } satisfies z.infer<typeof ResponseSchema>);
    },
);
