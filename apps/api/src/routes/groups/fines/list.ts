import { hasScopedPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { and, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { isGroupMember } from "~/lib/group";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { fineListSchema } from "./schema";
import { serializeFineLaw } from "./serialize";

export const listFinesRoute = route().get(
    "/:groupSlug/fines",
    describeRoute({
        tags: ["fines"],
        summary: "List fines for a group",
        operationId: "listFines",
        description:
            "Retrieve a list of fines for a group. Group members can view all fines in their own group (Lepton parity), as can the fines admin and anyone with 'fines:view' (globally or scoped). Supports filtering by status and user.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineListSchema,
            description: "List of fines retrieved successfully",
        })
        .forbidden({
            description: "Not authorized to view fines for this group",
        })
        .notFound({ description: "Group not found" })
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

        // Check authorization: group members see their own group's fines
        // (Lepton parity — the membership itself is the access), fines admin
        // and fines:view holders see them too.
        const isMember = await isGroupMember(ctx, user.id, groupSlug);
        const isFinesAdmin = group.finesAdminId === user.id;

        const hasViewPermission =
            isMember ||
            isFinesAdmin ||
            (await hasScopedPermission(
                ctx,
                user.id,
                "fines:view",
                `group:${groupSlug}`,
            ));

        if (!hasViewPermission) {
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

        // Include public user info (name/image) so the UI can display names
        // instead of user IDs
        const fines = await db.query.fine.findMany({
            where: and(...conditions),
            orderBy: desc(schema.fine.createdAt),
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
                // The paragraph the fine cites, so the list can show
                // "3.10 - Møtte ikke opp" instead of the bare reason.
                law: {
                    columns: {
                        id: true,
                        paragraph: true,
                        title: true,
                    },
                },
            },
        });

        return c.json(fines.map(serializeFineLaw));
    },
);
