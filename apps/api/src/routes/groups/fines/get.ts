import {
    hasPermission,
    hasScopedPermission,
    requireAuth,
} from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { isValidUUID } from "~/lib/validation/uuid";

export const fineSchema = z.object({
    id: z.string().meta({ description: "Fine ID" }),
    userId: z.string().meta({ description: "User ID who received the fine" }),
    groupSlug: z
        .string()
        .meta({ description: "Group slug that issued the fine" }),
    reason: z.string().meta({ description: "Reason for the fine" }),
    amount: z.number().meta({ description: "Fine amount in NOK" }),
    defense: z.string().nullable().meta({ description: "User's defense text" }),
    status: z.string().meta({
        description: "Fine status (pending, approved, paid, rejected)",
    }),
    createdByUserId: z
        .string()
        .nullable()
        .meta({ description: "User who created the fine" }),
    approvedByUserId: z
        .string()
        .nullable()
        .meta({ description: "User who approved the fine" }),
    approvedAt: z
        .string()
        .nullable()
        .meta({ description: "Approval timestamp" }),
    paidAt: z.string().nullable().meta({ description: "Payment timestamp" }),
    createdAt: z.string().meta({ description: "Creation timestamp" }),
    updatedAt: z.string().meta({ description: "Last update timestamp" }),
});

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
