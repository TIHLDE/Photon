import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

const updateQuoteSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    quote: z.string().min(1).optional(),
});

export const updateQuoteRoute = route().patch(
    "/:entryId/quotes/:quoteId",
    describeRoute({
        tags: ["master-study"],
        summary: "Update a quote",
        operationId: "updateMasterStudyQuote",
        description:
            "Update a single quote on a master study entry. Requires 'master_study:update' or 'master_study:manage' permission (admins and Beta).",
    })
        .response({
            statusCode: 200,
            description: "Quote updated successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Quote not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["master_study:update", "master_study:manage"] }),
    validator("json", updateQuoteSchema),
    async (c) => {
        const body = c.req.valid("json");
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

        const updateData: Partial<typeof schema.masterStudyQuote.$inferInsert> =
            {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.quote !== undefined) updateData.quote = body.quote;

        if (Object.keys(updateData).length === 0) {
            const response = {
                id: existing.id,
                name: existing.name,
                quote: existing.quote,
            };
            return c.json(response);
        }

        const [updated] = await db
            .update(schema.masterStudyQuote)
            .set(updateData)
            .where(
                and(
                    eq(schema.masterStudyQuote.entryId, entryId),
                    eq(schema.masterStudyQuote.id, quoteId),
                ),
            )
            .returning();

        if (!updated) {
            throw new HTTPException(404, {
                message: "Quote not found",
            });
        }

        return c.json({
            id: updated.id,
            name: updated.name,
            quote: updated.quote,
        });
    },
);
