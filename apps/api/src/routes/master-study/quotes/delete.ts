import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { touchMasterStudyEntry } from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { masterStudyMessageSchema, quoteParamSchema } from "../schema";

export const deleteQuoteRoute = route().delete(
    "/:entryId/quotes/:quoteId",
    describeRoute({
        tags: ["master-study"],
        summary: "Delete a quote",
        operationId: "deleteMasterStudyQuote",
        description:
            "Delete one quote. Requires 'master-study:delete' or 'master-study:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyMessageSchema,
            description: "Quote deleted",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Quote not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["master-study:delete", "master-study:manage"],
    }),
    validator("param", quoteParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { entryId, quoteId } = c.req.valid("param");

        await db.transaction(async (tx) => {
            const [deleted] = await tx
                .delete(schema.masterStudyQuote)
                .where(
                    and(
                        eq(schema.masterStudyQuote.id, quoteId),
                        eq(schema.masterStudyQuote.entryId, entryId),
                    ),
                )
                .returning({ id: schema.masterStudyQuote.id });

            if (!deleted) {
                throw new HTTPException(404, { message: "Quote not found" });
            }

            await touchMasterStudyEntry(tx, entryId);
        });

        return c.json({ message: "Quote deleted" });
    },
);
