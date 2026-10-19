import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { entryIdParamSchema, masterStudyMessageSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["master-study"],
        summary: "Delete master study entry",
        operationId: "deleteMasterStudyEntry",
        description:
            "Delete a master study entry and its quotes. Requires 'master-study:delete' or 'master-study:manage'.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: masterStudyMessageSchema,
            description: "Master study entry deleted",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Master study entry not found" })
        .build(),
    requireAuth,
    requireAccess({
        permission: ["master-study:delete", "master-study:manage"],
    }),
    validator("param", entryIdParamSchema),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.valid("param");

        const [deleted] = await db
            .delete(schema.masterStudyEntry)
            .where(eq(schema.masterStudyEntry.id, id))
            .returning({ id: schema.masterStudyEntry.id });

        if (!deleted) {
            throw new HTTPException(404, {
                message: "Master study entry not found",
            });
        }

        return c.json({ message: "Master study entry deleted" });
    },
);
