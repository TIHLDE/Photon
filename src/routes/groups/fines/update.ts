import { eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { schema } from "~/db";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { hasPermission } from "~/lib/auth/rbac/permissions";
import { hasScopedPermission } from "~/lib/auth/rbac/roles";

const updateFineSchema = z.object({
    defense: z.string().optional().meta({ description: "User's defense text" }),
    status: z
        .enum(["pending", "approved", "paid", "rejected"])
        .optional()
        .meta({ description: "Fine status" }),
    approvedByUserId: z
        .string()
        .optional()
        .meta({ description: "User who approved the fine" }),
});

const updateFineSchemaOpenAPI =
    await resolver(updateFineSchema).toOpenAPISchema();

export const updateFineRoute = route().patch(
    "/:groupSlug/fines/:fineId",
    describeRoute({
        tags: ["fines"],
        summary: "Partially update fine",
        description:
            "Partially update a fine. Only provided fields will be updated. Users can add defense to their own fines. Fines admins can update status and approve/reject fines.",
        requestBody: {
            content: {
                "application/json": { schema: updateFineSchemaOpenAPI.schema },
            },
        },
        responses: {
            200: {
                description: "Fine updated successfully",
            },
            400: {
                description: "Bad Request - Invalid status transition",
            },
            403: {
                description: "Forbidden - Not authorized to update this fine",
            },
            404: {
                description: "Not Found - Fine or group not found",
            },
        },
    }),
    requireAuth,
    validator("json", updateFineSchema),
    async (c) => {
        const body = c.req.valid("json");
        const fineId = c.req.param("fineId");
        const groupSlug = c.req.param("groupSlug");
        const ctx = c.get("ctx");
        const { db } = ctx;
        const user = c.get("user");

        // Validate UUID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(fineId)) {
            throw new HTTPException(404, {
                message: `Fine with ID "${fineId}" not found`,
            });
        }

        // Get fine
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

        // Get group
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

        const isOwner = fine.userId === user.id;
        const isFinesAdmin = group.finesAdminId === user.id;

        // Check for global or scoped fines:update permission
        const hasGlobalPerm = await hasPermission(ctx, user.id, "fines:update");
        const hasScopedPerm = await hasScopedPermission(
            ctx,
            user.id,
            "fines:update",
            `group:${groupSlug}`,
        );
        const hasUpdatePermission = hasGlobalPerm || hasScopedPerm;

        // Authorization checks
        if (body.status || body.approvedByUserId) {
            // Only fines admin or users with fines:update permission can change status or approver
            if (!isFinesAdmin && !hasUpdatePermission) {
                throw new HTTPException(403, {
                    message: "Only fines admin or users with fines:update permission can change fine status",
                });
            }
        }

        if (body.defense) {
            // Only the fine owner can add defense
            if (!isOwner) {
                throw new HTTPException(403, {
                    message: "Only the fine recipient can add a defense",
                });
            }
        }

        if (!isOwner && !isFinesAdmin && !hasUpdatePermission) {
            throw new HTTPException(403, {
                message: "Not authorized to update this fine",
            });
        }

        // Build update object
        const updateData: {
            updatedAt: Date;
            defense?: string;
            status?: "pending" | "approved" | "paid" | "rejected";
            approvedAt?: Date;
            approvedByUserId?: string;
            paidAt?: Date;
        } = {
            updatedAt: new Date(),
        };

        if (body.defense !== undefined) {
            updateData.defense = body.defense;
        }

        if (body.status !== undefined) {
            updateData.status = body.status;

            // Set timestamps based on status
            if (body.status === "approved") {
                updateData.approvedAt = new Date();
                updateData.approvedByUserId = user.id;
            } else if (body.status === "paid") {
                updateData.paidAt = new Date();
            }
        }

        await db
            .update(schema.fine)
            .set(updateData)
            .where(eq(schema.fine.id, fineId));

        return c.json({ message: "Fine updated successfully" }, 200);
    },
);
