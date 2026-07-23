import { hasPermission } from "@photon/auth/rbac";
import { hasScopedPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";
import { requireAuth } from "~/middleware/auth";
import { fineSchema } from "./schema";

export const getFineRoute = route().get(
    "/:groupSlug/fines/:fineId",
    describeRoute({
        tags: ["fines"],
        summary: "Get fine by ID",
        operationId: "getFine",
        description:
            "Retrieve detailed information about a specific fine. Users can view their own fines, fines admins can view all fines for their group.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineSchema,
            description: "Fine details retrieved successfully",
        })
        .forbidden({ description: "Not authorized to view this fine" })
        .notFound({ description: "Fine or group not found" })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const fineId = c.req.param("fineId");
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");

        if (!isValidUUID(fineId)) {
            throw new HTTPException(404, {
                message: `Fine with ID "${fineId}" not found`,
            });
        }

        // Include public user info (name/image) so the UI can display names
        // instead of user IDs
        const fine = await db.query.fine.findFirst({
            where: eq(schema.fine.id, fineId),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                createdByUser: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

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

        // Check authorization: user can view their own fines, fines admin can view all,
        // OR user has fines:view permission (globally or scoped to this group)
        const isOwner = fine.userId === user.id;

        if (!isOwner) {
            const group = await db
                .select()
                .from(schema.group)
                .where(eq(schema.group.slug, groupSlug))
                .limit(1)
                .then((res) => res[0]);

            const isFinesAdmin = group?.finesAdminId === user.id;

            // Check for global or scoped fines:view permission
            const hasGlobalPerm = await hasPermission(
                ctx,
                user.id,
                "fines:view",
            );
            const hasScopedPerm = await hasScopedPermission(
                ctx,
                user.id,
                "fines:view",
                `group:${groupSlug}`,
            );

            if (!isFinesAdmin && !hasGlobalPerm && !hasScopedPerm) {
                throw new HTTPException(403, {
                    message: "Not authorized to view this fine",
                });
            }
        }

        return c.json(fine);
    },
);
