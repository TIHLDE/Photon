import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";

export const deleteRoute = route().delete(
    "/:id",
    describeRoute({
        tags: ["master-study"],
        summary: "Delete master study entry",
        operationId: "deleteMasterStudyEntry",
        description:
            "Delete a master study entry. Requires 'master_study:delete' or 'master_study:manage' permission (admins and Beta).",
    })
        .response({
            statusCode: 200,
            description: "Master study entry deleted successfully",
        })
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Master study entry not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["master_study:delete", "master_study:manage"] }),
    async (c) => {
        const { db } = c.get("ctx");
        const { id } = c.req.param();

        const entry = await db.query.masterStudyEntry.findFirst({
            where: eq(schema.masterStudyEntry.id, id),
        });

        if (!entry) {
            throw new HTTPException(404, {
                message: "Master study entry not found",
            });
        }

        await db
            .delete(schema.masterStudyEntry)
            .where(eq(schema.masterStudyEntry.id, id));

        return c.json({ message: "Master study entry deleted successfully" });
    },
);
