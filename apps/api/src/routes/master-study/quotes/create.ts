import { schema } from "@photon/db";
import { eq, max } from "drizzle-orm";
import { validator } from "hono-openapi";
import {
    toMasterStudyQuoteResponse,
    touchMasterStudyEntry,
} from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    createQuoteSchema,
    entryIdOnlyParamSchema,
    masterStudyQuoteSchema,
} from "../schema";

export const createQuoteRoute = route().post(
    "/:entryId/quotes",
    describeRoute({
        tags: ["master-study"],
        summary: "Add a quote",
        operationId: "createMasterStudyQuote",
        description:
            "Add one quote to the end of a master study entry. Requires 'master-study:update' or 'master-study:manage'.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: masterStudyQuoteSchema,
            description: "Quote added",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Master study entry not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["master-study:update", "master-study:manage"],
    }),
    validator("param", entryIdOnlyParamSchema),
    validator("json", createQuoteSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { entryId } = c.req.valid("param");
        const body = c.req.valid("json");

        const quote = await db.transaction(async (tx) => {
            await touchMasterStudyEntry(tx, entryId);

            const [last] = await tx
                .select({ position: max(schema.masterStudyQuote.position) })
                .from(schema.masterStudyQuote)
                .where(eq(schema.masterStudyQuote.entryId, entryId));

            const [created] = await tx
                .insert(schema.masterStudyQuote)
                .values({
                    entryId,
                    name: body.name ?? null,
                    quote: body.quote,
                    position: (last?.position ?? -1) + 1,
                })
                .returning();

            return created!;
        });

        return c.json(toMasterStudyQuoteResponse(quote), 201);
    },
);
