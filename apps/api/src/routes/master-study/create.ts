import { schema } from "@photon/db";
import { validator } from "hono-openapi";
import {
    assertStudyProgramExists,
    getMasterStudyEntryOr404,
    toMasterStudyEntryResponse,
} from "~/lib/master-study";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { createMasterStudySchema, masterStudyEntrySchema } from "./schema";

export const createRoute = route().post(
    "/",
    describeRoute({
        tags: ["master-study"],
        summary: "Create master study entry",
        operationId: "createMasterStudyEntry",
        description:
            "Create a master study entry with optional quotes. Requires 'master-study:create' or 'master-study:manage'.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: masterStudyEntrySchema,
            description: "Master study entry created",
        })
        .badRequest({ description: "Invalid input or unknown study program" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["master-study:create", "master-study:manage"],
    }),
    validator("json", createMasterStudySchema),
    async (c) => {
        const { quotes, applicationDeadline, ...body } = c.req.valid("json");
        const userId = c.get("user").id;
        const { db } = c.get("ctx");

        await assertStudyProgramExists(db, body.studyProgramId);

        const entry = await db.transaction(async (tx) => {
            const [created] = await tx
                .insert(schema.masterStudyEntry)
                .values({
                    ...body,
                    applicationDeadline: applicationDeadline
                        ? new Date(applicationDeadline)
                        : null,
                    createdById: userId,
                })
                .returning({ id: schema.masterStudyEntry.id });

            if (quotes.length > 0) {
                await tx.insert(schema.masterStudyQuote).values(
                    quotes.map((q, position) => ({
                        entryId: created!.id,
                        name: q.name ?? null,
                        quote: q.quote,
                        position,
                    })),
                );
            }

            return getMasterStudyEntryOr404(tx, created!.id);
        });

        return c.json(toMasterStudyEntryResponse(entry), 201);
    },
);
