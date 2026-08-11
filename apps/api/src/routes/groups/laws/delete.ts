import { schema } from "@photon/db";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { requireAuth } from "~/middleware/auth";
import { canManageLaws } from "./permissions";

export const deleteLawRoute = route().delete(
    "/:groupSlug/laws/:lawId",
    describeRoute({
        tags: ["laws"],
        summary: "Delete a law",
        operationId: "deleteLaw",
        description:
            "Delete a paragraph from a group's lovverk. Requires being the group's fines admin (botsjef) or a group leader.",
    })
        .response({ statusCode: 204, description: "Law successfully deleted" })
        .forbidden({
            description: "Not authorized to manage laws for this group",
        })
        .notFound({ description: "Law or group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const lawId = c.req.param("lawId");
        const user = c.get("user");

        if (!isValidUUID(lawId)) {
            throw new HTTPException(404, {
                message: `Law with ID "${lawId}" not found`,
            });
        }

        const group = await db
            .select()
            .from(schema.group)
            .where(eq(schema.group.slug, groupSlug))
            .limit(1)
            .then((res) => res[0]);

        if (!group) {
            throw new HTTPException(404, {
                message: `Group with slug "${groupSlug}" not found`,
            });
        }

        if (!(await canManageLaws(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to manage laws for this group",
            });
        }

        const deleted = await db
            .delete(schema.groupLaw)
            .where(
                and(
                    eq(schema.groupLaw.id, lawId),
                    eq(schema.groupLaw.groupSlug, groupSlug),
                ),
            )
            .returning();

        if (deleted.length === 0) {
            throw new HTTPException(404, {
                message: `Law with ID "${lawId}" not found`,
            });
        }

        return c.body(null, 204);
    },
);
