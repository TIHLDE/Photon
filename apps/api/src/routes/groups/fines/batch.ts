import { schema } from "@photon/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { canUpdateFines, requireFinesGroup } from "./permissions";
import {
    batchUpdateFinesResponseSchema,
    batchUpdateFinesSchema,
    batchUpdateUserFinesSchema,
} from "./schema";

type FineStatus = "pending" | "approved" | "paid" | "rejected";

/**
 * The same timestamp bookkeeping the single-fine PATCH does, so a fine settled
 * in bulk is indistinguishable from one settled by hand.
 */
function statusUpdate(status: FineStatus, actingUserId: string) {
    return {
        status,
        updatedAt: new Date(),
        ...(status === "approved"
            ? { approvedAt: new Date(), approvedByUserId: actingUserId }
            : {}),
        ...(status === "paid" ? { paidAt: new Date() } : {}),
    };
}

export const batchUpdateFinesRoute = route().patch(
    "/:groupSlug/fines/batch",
    describeRoute({
        tags: ["fines"],
        summary: "Update several fines at once",
        operationId: "batchUpdateFines",
        description:
            "Set the same status on a list of fines. Every fine must belong to the group in the path. Requires being the fines admin (botsjef) or the group's leader.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: batchUpdateFinesResponseSchema,
            description: "Fines updated successfully",
        })
        .badRequest({ description: "A fine does not belong to this group" })
        .forbidden({
            description: "Not authorized to settle this group's fines",
        })
        .notFound({
            description: "Group not found, or fines not activated for it",
        })
        .build(),
    requireAuth,
    validator("json", batchUpdateFinesSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");
        const { fineIds, status } = c.req.valid("json");

        const group = await requireFinesGroup(ctx, groupSlug);

        if (!(await canUpdateFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message:
                    "Only the fines admin or the group's leader can change fine status",
            });
        }

        // Update by (id, groupSlug) and compare the row count, so a stray ID
        // from another group is rejected rather than silently skipped.
        const updated = await db
            .update(schema.fine)
            .set(statusUpdate(status, user.id))
            .where(
                and(
                    inArray(schema.fine.id, fineIds),
                    eq(schema.fine.groupSlug, groupSlug),
                ),
            )
            .returning({ id: schema.fine.id });

        if (updated.length !== fineIds.length) {
            throw new HTTPException(400, {
                message: `Some fines do not exist in group "${groupSlug}"`,
            });
        }

        return c.json({
            message: "Fines updated successfully",
            updated: updated.length,
        });
    },
);

export const batchUpdateUserFinesRoute = route().patch(
    "/:groupSlug/fines/users/:userId/batch",
    describeRoute({
        tags: ["fines"],
        summary: "Update all of one member's fines",
        operationId: "batchUpdateUserFines",
        description:
            "Set the same status on every fine the member has in this group, regardless of any filter the caller is currently looking at (Lepton parity). Requires being the fines admin (botsjef) or the group's leader.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: batchUpdateFinesResponseSchema,
            description: "Fines updated successfully",
        })
        .forbidden({
            description: "Not authorized to settle this group's fines",
        })
        .notFound({
            description: "Group not found, or fines not activated for it",
        })
        .build(),
    requireAuth,
    validator("json", batchUpdateUserFinesSchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const targetUserId = c.req.param("userId");
        const user = c.get("user");
        const { status } = c.req.valid("json");

        const group = await requireFinesGroup(ctx, groupSlug);

        if (!(await canUpdateFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message:
                    "Only the fines admin or the group's leader can change fine status",
            });
        }

        // Skipping rows that already hold the target status keeps `approvedAt`
        // and `paidAt` pointing at when the fine was actually settled.
        const updated = await db
            .update(schema.fine)
            .set(statusUpdate(status, user.id))
            .where(
                and(
                    eq(schema.fine.groupSlug, groupSlug),
                    eq(schema.fine.userId, targetUserId),
                    ne(schema.fine.status, status),
                ),
            )
            .returning({ id: schema.fine.id });

        return c.json({
            message: "Fines updated successfully",
            updated: updated.length,
        });
    },
);
