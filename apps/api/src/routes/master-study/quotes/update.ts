import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    toMasterStudyQuoteResponse,
    touchMasterStudyEntry,
} from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    masterStudyQuoteSchema,
    quoteParamSchema,
    updateQuoteSchema,
} from "../schema";

export const updateQuoteRoute = route().patch(
    "/:entryId/quotes/:quoteId",
    describeRoute({
        tags: ["master-study"],
        summary: "Update a quote",
        operationId: "updateMasterStudyQuote",
        description:
            "Edit one quote. Sending `name: null` makes it anonymous. Requires 'master-study:update' or 'master-study:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyQuoteSchema,
            description: "Quote updated",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Quote not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["master-study:update", "master-study:manage"],
    }),
    validator("param", quoteParamSchema),
    validator("json", updateQuoteSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { entryId, quoteId } = c.req.valid("param");
        const body = c.req.valid("json");

        const quote = await db.transaction(async (tx) => {
            const [updated] = await tx
                .update(schema.masterStudyQuote)
                .set(body)
                .where(
                    and(
                        eq(schema.masterStudyQuote.id, quoteId),
                        eq(schema.masterStudyQuote.entryId, entryId),
                    ),
                )
                .returning();

            if (!updated) {
                throw new HTTPException(404, { message: "Quote not found" });
            }

            await touchMasterStudyEntry(tx, entryId);

            return updated;
        });

        return c.json(toMasterStudyQuoteResponse(quote));
    },
);
