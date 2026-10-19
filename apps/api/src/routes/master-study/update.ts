import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import {
    assertStudyProgramExists,
    getMasterStudyEntryOr404,
    toMasterStudyEntryResponse,
} from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    entryIdParamSchema,
    masterStudyEntrySchema,
    updateMasterStudySchema,
} from "./schema";

export const updateRoute = route().patch(
    "/:id",
    describeRoute({
        tags: ["master-study"],
        summary: "Update master study entry",
        operationId: "updateMasterStudyEntry",
        description:
            "Partly update a master study entry. Sending `quotes` replaces every quote on it. Setting `hasFinancialSupport` to false clears `financialSupport`. Requires 'master-study:update' or 'master-study:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyEntrySchema,
            description: "Master study entry updated",
        })
        .badRequest({ description: "Invalid input or unknown study program" })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Master study entry not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["master-study:update", "master-study:manage"],
    }),
    validator("param", entryIdParamSchema),
    validator("json", updateMasterStudySchema),
    async (c) => {
        const { quotes, applicationDeadline, ...body } = c.req.valid("json");
        const { id } = c.req.valid("param");
        const { db } = c.get("ctx");

        const existing = await getMasterStudyEntryOr404(db, id);

        if (body.studyProgramId !== undefined) {
            await assertStudyProgramExists(db, body.studyProgramId);
        }

        const hasFinancialSupport =
            body.hasFinancialSupport ?? existing.hasFinancialSupport;
        if (!hasFinancialSupport && body.financialSupport != null) {
            throw new HTTPException(400, {
                message:
                    "financialSupport can only be set when hasFinancialSupport is true",
            });
        }

        const entry = await db.transaction(async (tx) => {
            // Always written, so updatedAt moves even when only the quotes
            // changed.
            await tx
                .update(schema.masterStudyEntry)
                .set({
                    ...body,
                    ...(!hasFinancialSupport && { financialSupport: null }),
                    ...(applicationDeadline !== undefined && {
                        applicationDeadline: applicationDeadline
                            ? new Date(applicationDeadline)
                            : null,
                    }),
                    updatedAt: new Date(),
                })
                .where(eq(schema.masterStudyEntry.id, id));

            if (quotes !== undefined) {
                await tx
                    .delete(schema.masterStudyQuote)
                    .where(eq(schema.masterStudyQuote.entryId, id));

                if (quotes.length > 0) {
                    await tx.insert(schema.masterStudyQuote).values(
                        quotes.map((q, position) => ({
                            entryId: id,
                            name: q.name ?? null,
                            quote: q.quote,
                            position,
                        })),
                    );
                }
            }

            return getMasterStudyEntryOr404(tx, id);
        });

        return c.json(toMasterStudyEntryResponse(entry));
    },
);
