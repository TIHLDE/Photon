import { schema } from "@photon/db";
import { and, desc, eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import z from "zod";
import { isEventOwner } from "~/lib/event/middleware";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { requireAccess } from "~/middleware/access";
import { requireAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { eventPaymentListResponseSchema } from "../schema";

const querySchema = PaginationSchema.extend({
    status: z
        .enum(["pending", "paid", "refunded", "failed"])
        .optional()
        .describe("Only return payments with this status"),
});

export const listEventPaymentsRoute = route().get(
    "/:eventId/payments",
    describeRoute({
        tags: ["events", "payments"],
        summary: "List event payments",
        operationId: "listEventPayments",
        description:
            "Retrieve a paginated list of every payment for an event, including the payer and a status summary. Requires 'events:payments:view', 'events:manage' or 'events:update' — or being the event's creator.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventPaymentListResponseSchema,
            description: "OK",
        })
        .forbidden({
            description: "Requires permission to view the event's payments",
        })
        .build(),
    requireAuth,
    // `hasPermission` is an exact string match with no hierarchy, so
    // `events:manage` does NOT imply `events:payments:view`. Every permission
    // that should grant read access has to be listed explicitly.
    requireAccess({
        permission: ["events:payments:view", "events:manage", "events:update"],
        ownership: { param: "eventId", check: isEventOwner },
    }),
    validator("query", querySchema),
    async (c) => {
        const { db } = c.get("ctx");
        const eventId = c.req.param("eventId");
        const { page, pageSize, status } = c.req.valid("query");

        const filters = status
            ? and(
                  eq(schema.eventPayment.eventId, eventId),
                  eq(schema.eventPayment.status, status),
              )
            : eq(schema.eventPayment.eventId, eventId);

        const totalCount = await db.$count(schema.eventPayment, filters);

        const payments = await db.query.eventPayment.findMany({
            where: filters,
            orderBy: (p) => [desc(p.createdAt)],
            limit: pageSize,
            offset: getPageOffset(page, pageSize),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                        email: true,
                    },
                },
            },
        });

        // The summary covers the whole event, not just the current page, so it
        // is computed from an unfiltered read of every payment row.
        const allPayments = await db
            .select({
                status: schema.eventPayment.status,
                amountMinor: schema.eventPayment.amountMinor,
            })
            .from(schema.eventPayment)
            .where(eq(schema.eventPayment.eventId, eventId));

        const summary = {
            paidCount: allPayments.filter((p) => p.status === "paid").length,
            pendingCount: allPayments.filter((p) => p.status === "pending")
                .length,
            refundedCount: allPayments.filter((p) => p.status === "refunded")
                .length,
            failedCount: allPayments.filter((p) => p.status === "failed")
                .length,
            totalPaidMinor: allPayments
                .filter((p) => p.status === "paid")
                .reduce((sum, p) => sum + p.amountMinor, 0),
        };

        const totalPages = getTotalPages(totalCount, pageSize);

        return c.json({
            totalCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            payments: payments.map((p) => ({
                id: p.id,
                userId: p.userId,
                user: {
                    id: p.user.id,
                    name: p.user.name,
                    image: p.user.image,
                    email: p.user.email,
                },
                amountMinor: p.amountMinor,
                currency: p.currency,
                provider: p.provider,
                providerPaymentId: p.providerPaymentId,
                status: p.status,
                receivedPaymentAt: p.receivedPaymentAt?.toISOString() ?? null,
                expiresAt: p.expiresAt?.toISOString() ?? null,
                createdAt: p.createdAt.toISOString(),
            })),
            summary,
        } satisfies z.infer<typeof eventPaymentListResponseSchema>);
    },
);
