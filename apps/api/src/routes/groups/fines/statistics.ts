import { schema } from "@photon/db";
import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAuth } from "~/middleware/auth";
import { canViewFines, requireFinesGroup } from "./permissions";
import { fineStatisticsSchema } from "./schema";

export const fineStatisticsRoute = route().get(
    "/:groupSlug/fines/statistics",
    describeRoute({
        tags: ["fines"],
        summary: "Fine totals for a group",
        operationId: "getFineStatistics",
        description:
            "Sum of fine amounts per settlement stage for a group: awaiting approval, approved but unpaid, and paid. Rejected fines are excluded. Same audience as the fine list.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: fineStatisticsSchema,
            description: "Statistics retrieved successfully",
        })
        .forbidden({
            description: "Not authorized to view fines for this group",
        })
        .notFound({
            description: "Group not found, or fines not activated for it",
        })
        .build(),
    requireAuth,
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const groupSlug = c.req.param("groupSlug");
        const user = c.get("user");

        const group = await requireFinesGroup(ctx, groupSlug);

        if (!(await canViewFines(ctx, user.id, group))) {
            throw new HTTPException(403, {
                message: "Not authorized to view fines for this group",
            });
        }

        // One pass over the group's fines rather than three counting queries.
        const [totals] = await db
            .select({
                notApproved: sql<number>`coalesce(sum(case when ${schema.fine.status} = 'pending' then ${schema.fine.amount} else 0 end), 0)::int`,
                approvedNotPaid: sql<number>`coalesce(sum(case when ${schema.fine.status} = 'approved' then ${schema.fine.amount} else 0 end), 0)::int`,
                paid: sql<number>`coalesce(sum(case when ${schema.fine.status} = 'paid' then ${schema.fine.amount} else 0 end), 0)::int`,
            })
            .from(schema.fine)
            .where(eq(schema.fine.groupSlug, groupSlug));

        return c.json({
            notApproved: totals?.notApproved ?? 0,
            approvedNotPaid: totals?.approvedNotPaid ?? 0,
            paid: totals?.paid ?? 0,
        });
    },
);
