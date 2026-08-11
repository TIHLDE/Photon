import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { requireAuth } from "~/middleware/auth";
import { canUpdateFines, requireFinesGroup } from "./permissions";

export const deleteFineRoute = route().delete(
    "/:groupSlug/fines/:fineId",
    describeRoute({
        tags: ["fines"],
        summary: "Delete a fine",
        operationId: "deleteFine",
        description:
            "Delete a fine by its ID. Requires being the fines admin (botsjef) or the group's leader. This action is irreversible.",
    })
        .response({ statusCode: 204, description: "Fine successfully deleted" })
        .forbidden({ description: "Not authorized to delete this fine" })
        .notFound({ description: "Fine or group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const fineId = c.req.param("fineId");
        const groupSlug = c.req.param("groupSlug");
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");

        if (!isValidUUID(fineId)) {
            throw new HTTPException(404, {
                message: `Fine with ID "${fineId}" not found`,
            });
        }

        // Check if the fine exists
        const fine = await db
            .select()
            .from(schema.fine)
            .where(eq(schema.fine.id, fineId))
            .limit(1)
            .then((res) => res[0]);

        if (!fine) {
            throw new HTTPException(404, {
                message: `Fine with ID "${fineId}" not found`,
            });
        }

        if (fine.groupSlug !== groupSlug) {
            throw new HTTPException(404, {
                message: `Fine does not belong to group "${groupSlug}"`,
            });
        }

        // Deleting is settling: the botsjef, the group's leader, or root.
        const group = await requireFinesGroup(ctx, groupSlug);

        if (!(await canUpdateFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to delete this fine",
            });
        }

        // Delete the fine
        await db.delete(schema.fine).where(eq(schema.fine.id, fineId));

        return c.body(null, 204);
    },
);
