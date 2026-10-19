import { type DbSchema, type DbTransaction, schema } from "@photon/db";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { HTTPException } from "hono/http-exception";

type Db = NodePgDatabase<DbSchema> | DbTransaction;

type MasterStudyEntryRow = typeof schema.masterStudyEntry.$inferSelect & {
    studyProgram: typeof schema.studyProgram.$inferSelect;
    quotes: (typeof schema.masterStudyQuote.$inferSelect)[];
};

/** The relations every response carries, in the order they are shown. */
export const masterStudyEntryWith = {
    studyProgram: true,
    quotes: {
        orderBy: (quote, { asc }) => [asc(quote.position), asc(quote.id)],
    },
} satisfies NonNullable<
    Parameters<
        NodePgDatabase<DbSchema>["query"]["masterStudyEntry"]["findFirst"]
    >[0]
>["with"];

/**
 * The one place a master study row becomes an API response — list, get,
 * create and update all go through it.
 */
export function toMasterStudyEntryResponse(entry: MasterStudyEntryRow) {
    return {
        id: entry.id,
        studyProgramId: entry.studyProgramId,
        studyProgram: {
            id: entry.studyProgram.id,
            slug: entry.studyProgram.slug,
            displayName: entry.studyProgram.displayName,
            type: entry.studyProgram.type,
        },
        name: entry.name,
        location: entry.location,
        locationType: entry.locationType,
        link: entry.link,
        hasFinancialSupport: entry.hasFinancialSupport,
        financialSupport: entry.financialSupport,
        subjectRequirements: entry.subjectRequirements,
        otherRequirements: entry.otherRequirements,
        summary: entry.summary,
        applicationDeadline: entry.applicationDeadline?.toISOString() ?? null,
        quotes: entry.quotes.map(toMasterStudyQuoteResponse),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
    };
}

export function toMasterStudyQuoteResponse(
    quote: typeof schema.masterStudyQuote.$inferSelect,
) {
    return { id: quote.id, name: quote.name, quote: quote.quote };
}

/** Load one entry with its relations, or throw 404. */
export async function getMasterStudyEntryOr404(db: Db, id: string) {
    const entry = await db.query.masterStudyEntry.findFirst({
        where: eq(schema.masterStudyEntry.id, id),
        with: masterStudyEntryWith,
    });

    if (!entry) {
        throw new HTTPException(404, {
            message: "Master study entry not found",
        });
    }

    return entry;
}

/** 400 instead of the foreign-key violation an unknown programme would hit. */
export async function assertStudyProgramExists(db: Db, studyProgramId: number) {
    const program = await db.query.studyProgram.findFirst({
        where: eq(schema.studyProgram.id, studyProgramId),
        columns: { id: true },
    });

    if (!program) {
        throw new HTTPException(400, {
            message: "Study program not found",
        });
    }
}

/**
 * Bump `updatedAt` on an entry whose quotes changed, so "sist oppdatert"
 * and the list order reflect it. Throws 404 if the entry does not exist.
 */
export async function touchMasterStudyEntry(db: Db, id: string) {
    const [touched] = await db
        .update(schema.masterStudyEntry)
        .set({ updatedAt: new Date() })
        .where(eq(schema.masterStudyEntry.id, id))
        .returning({ id: schema.masterStudyEntry.id });

    if (!touched) {
        throw new HTTPException(404, {
            message: "Master study entry not found",
        });
    }
}
