import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { hasPermission } from "~/lib/auth/rbac/permissions";
import { hasScopedPermission } from "~/lib/auth/rbac/roles";
import { describeAuthenticatedRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { fineSchema } from "./get";

const fineListSchema = z.array(fineSchema);

export const listFinesRoute = route().get(
    "/:groupSlug/fines",
    describeAuthenticatedRoute({
        tags: ["fines"],
        summary: "List fines for a group",
        operationId: "listFines",
        description:
            "Retrieve a list of fines for a group. Users can view their own fines, fines admins can view all fines for their group. Supports filtering by status and user.",
    })
        .schemaResponse(
            200,
            fineListSchema,
            "List of fines retrieved successfully",
        )
        .forbidden("Not authorized to view fines for this group")
        .notFound("Group not found")
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");
        const statusFilter = c.req.query("status");
        const userIdFilter = c.req.query("userId");

        // Validate group exists
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

        // Check authorization
        const isFinesAdmin = group.finesAdminId === user.id;

        // Check for global or scoped fines:view permission
        const hasGlobalPerm = await hasPermission(ctx, user.id, "fines:view");
        const hasScopedPerm = await hasScopedPermission(
            ctx,
            user.id,
            "fines:view",
            `group:${groupSlug}`,
        );
        const hasViewPermission = hasGlobalPerm || hasScopedPerm;

        // Only fines admin or users with fines:view permission can list fines
        if (!isFinesAdmin && !hasViewPermission) {
            throw new HTTPException(403, {
                message: "Not authorized to view fines for this group",
            });
        }

        // Build query conditions
        const conditions = [eq(schema.fine.groupSlug, groupSlug)];

        // Fines admin or users with fines:view permission can filter by specific user
        if (userIdFilter) {
            conditions.push(eq(schema.fine.userId, userIdFilter));
        }

        // Add status filter if provided
        if (
            statusFilter &&
            (statusFilter === "pending" ||
                statusFilter === "approved" ||
                statusFilter === "paid" ||
                statusFilter === "rejected")
        ) {
            conditions.push(eq(schema.fine.status, statusFilter));
        }

        const fines = await db
            .select()
            .from(schema.fine)
            .where(and(...conditions))
            .orderBy(desc(schema.fine.createdAt));

        return c.json(fines);
    },
);
