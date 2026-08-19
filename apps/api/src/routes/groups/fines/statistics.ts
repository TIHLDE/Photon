import { schema } from "@photon/db";
import { and, eq, sql } from "drizzle-orm";
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
            "Sum of fine amounts per settlement stage for a group: awaiting approval, approved but unpaid, and paid. Rejected fines are excluded. The unpaid totals only count the group's current members — a fine follows the person out of the group, but the debt does not. 'paid' is history and counts everyone. Same audience as the fine list.",
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

        /**
         * The unpaid totals are the group's outstanding debt right now, and
         * that has to be the same number the per-member list adds up to. That
         * list is driven by the membership table, so someone removed from the
         * group drops out of it — leaving the group ends their bøter there.
         * Summing the fine table alone kept counting them and made the two
         * views disagree, so the membership row gates the unpaid sums here as
         * well.
         *
         * 'paid' is left alone: it is history, and a settled fine stays part
         * of what the group has collected no matter who has left since.
         */
        const isMember = sql`${schema.groupMembership.userId} is not null`;

        // One pass over the group's fines rather than three counting queries.
        const [totals] = await db
            .select({
                notApproved: sql<number>`coalesce(sum(case when ${schema.fine.status} = 'pending' and ${isMember} then ${schema.fine.amount} else 0 end), 0)::int`,
                approvedNotPaid: sql<number>`coalesce(sum(case when ${schema.fine.status} = 'approved' and ${isMember} then ${schema.fine.amount} else 0 end), 0)::int`,
                paid: sql<number>`coalesce(sum(case when ${schema.fine.status} = 'paid' then ${schema.fine.amount} else 0 end), 0)::int`,
            })
            .from(schema.fine)
            .leftJoin(
                schema.groupMembership,
                and(
                    eq(schema.groupMembership.userId, schema.fine.userId),
                    eq(schema.groupMembership.groupSlug, schema.fine.groupSlug),
                ),
            )
            .where(eq(schema.fine.groupSlug, groupSlug));

        return c.json({
            notApproved: totals?.notApproved ?? 0,
            approvedNotPaid: totals?.approvedNotPaid ?? 0,
            paid: totals?.paid ?? 0,
        });
    },
);
