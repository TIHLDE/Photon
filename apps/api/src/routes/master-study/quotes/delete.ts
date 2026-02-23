import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

export const deleteQuoteRoute = route().delete(
    "/:entryId/quotes/:quoteId",
    describeRoute({
        tags: ["master-study"],
        summary: "Delete a quote",
        operationId: "deleteMasterStudyQuote",
        description:
            "Delete a single quote from a master study entry. Requires 'master_study:update' or 'master_study:manage' permission (admins and Beta).",
    })
        .response({
            statusCode: 200,
            description: "Quote deleted successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Quote not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["master_study:update", "master_study:manage"] }),
    async (c) => {
        const { db } = c.get("ctx");
        const { entryId, quoteId } = c.req.param();

        const existing = await db.query.masterStudyQuote.findFirst({
            where: and(
                eq(schema.masterStudyQuote.entryId, entryId),
                eq(schema.masterStudyQuote.id, quoteId),
            ),
        });

        if (!existing) {
            throw new HTTPException(404, {
                message: "Quote not found",
            });
        }

        await db
            .delete(schema.masterStudyQuote)
            .where(
                and(
                    eq(schema.masterStudyQuote.entryId, entryId),
                    eq(schema.masterStudyQuote.id, quoteId),
                ),
            );

        return c.json({ message: "Quote deleted successfully" });
    },
);
