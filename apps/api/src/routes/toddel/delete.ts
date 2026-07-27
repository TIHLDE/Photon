import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPAppException } from "~/lib/errors";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import { deleteToddelResponseSchema } from "./schema";

export const deleteRoute = route().delete(
    "/:edition",
    describeRoute({
        tags: ["toddel"],
        summary: "Remove a TÖDDEL issue",
        operationId: "deleteToddel",
        description:
            "Take an issue out of the archive. The uploaded files are left in storage — a wrongly deleted issue can then be restored by re-creating it with the same keys. Requires 'toddel:delete' permission.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: deleteToddelResponseSchema,
            description: "Issue removed",
        })
        .unauthorized()
        .forbidden({ description: "Insufficient permissions" })
        .notFound({ description: "Issue not found" })
        .build(),
    requireAuth,
    requireAccess({ permission: ["toddel:delete", "toddel:manage"] }),
    async (c) => {
        const { db } = c.get("ctx");
        const edition = Number(c.req.param("edition"));

        if (!Number.isInteger(edition)) {
            throw HTTPAppException.BadRequest("Edition must be a whole number");
        }

        const [deleted] = await db
            .delete(schema.toddel)
            .where(eq(schema.toddel.edition, edition))
            .returning();

        if (!deleted) {
            throw HTTPAppException.NotFound("TÖDDEL issue");
        }

        return c.json({ message: "TÖDDEL issue removed" }, 200);
    },
);
