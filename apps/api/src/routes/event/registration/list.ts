import { hasPermission } from "@photon/auth/rbac";
import { schema } from "@photon/db";
import { registrationStatusVariants } from "@photon/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import { captureAuth } from "~/middleware/auth";
import {
    PaginationSchema,
    getPageOffset,
    getTotalPages,
} from "~/middleware/pagination";
import { eventRegistrationListResponseSchema } from "../schema";

/**
 * The statuses that count as "successfully registered". This is the public
 * default and must not change: the event page renders `totalCount` from this
 * endpoint as the visible registration count.
 */
const DEFAULT_STATUSES = ["registered", "attended", "no_show"] as const;

const querySchema = PaginationSchema.extend({
    status: z
        .string()
        .optional()
        .describe(
            "Comma-separated registration statuses to include. Admin only; defaults to registered,attended,no_show.",
        ),
});

export const getAllRegistrationsForEventsRoute = route().get(
    "/:eventId/registration",
    describeRoute({
        tags: ["events"],
        summary: "Get event registrations",
        operationId: "listEventRegistrations",
        description:
            "Retrieve a paginated list of users registered for a specific event. Event admins additionally receive email, registration time, waitlist position and payment status, and may filter by registration status.",
    })
        .schemaResponse({
            statusCode: 200,
            schema: eventRegistrationListResponseSchema,
            description: "OK",
        })
        .badRequest({ description: "Unknown registration status" })
        .forbidden({
            description: "Filtering by status requires event admin permissions",
        })
        .build(),
    captureAuth,
    validator("query", querySchema),
    async (c) => {
        const ctx = c.get("ctx");
        const { db } = ctx;
        const { pageSize, page, status } = c.req.valid("query");
        const eventId = c.req.param("eventId");

        // Email, payment status, waitlist position and photo consent are all
        // admin-facing: only include them for callers who can manage events.
        const user = c.get("user");
        const isEventAdmin = user
            ? await hasPermission(ctx, user.id, [
                  "events:update",
                  "events:manage",
                  "events:registrations:view",
              ])
            : false;

        let statuses: readonly string[] = DEFAULT_STATUSES;
        if (status) {
            if (!isEventAdmin) {
                throw new HTTPException(403, {
                    message:
                        "Filtering registrations by status requires event admin permissions",
                });
            }

            const requested = status
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const unknown = requested.filter(
                (s) =>
                    !(registrationStatusVariants as readonly string[]).includes(
                        s,
                    ),
            );
            if (unknown.length > 0) {
                throw new HTTPException(400, {
                    message: `Unknown registration status: ${unknown.join(", ")}`,
                });
            }
            if (requested.length > 0) {
                statuses = requested;
            }
        }

        const filters = and(
            eq(schema.eventRegistration.eventId, eventId),
            inArray(
                schema.eventRegistration.status,
                statuses as unknown as (typeof registrationStatusVariants)[number][],
            ),
        );

        const registrationCount = await db.$count(
            schema.eventRegistration,
            filters,
        );

        const registrations = await db.query.eventRegistration.findMany({
            orderBy: (r) => [desc(r.createdAt)],
            where: filters,
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

        // `eventRegistration` and `eventPayment` have no relation — payment
        // references (userId, eventId) independently — so payments for the
        // current page are fetched separately and joined in memory.
        type PaymentRow = typeof schema.eventPayment.$inferSelect;
        const paymentByUserId = new Map<string, PaymentRow>();

        if (isEventAdmin && registrations.length > 0) {
            const userIds = registrations.map((r) => r.userId);
            const payments = await db.query.eventPayment.findMany({
                where: (p, { and, eq, inArray }) =>
                    and(eq(p.eventId, eventId), inArray(p.userId, userIds)),
            });

            // A user can hold several payment rows for one event (a new
            // checkout is allowed after a failed or refunded attempt). Pick
            // deterministically: paid wins, then pending, then most recent.
            const rank = (s: string) =>
                s === "paid" ? 2 : s === "pending" ? 1 : 0;
            for (const payment of payments) {
                const current = paymentByUserId.get(payment.userId);
                const isBetter =
                    !current ||
                    rank(payment.status) > rank(current.status) ||
                    (rank(payment.status) === rank(current.status) &&
                        payment.createdAt > current.createdAt);
                if (isBetter) {
                    paymentByUserId.set(payment.userId, payment);
                }
            }
        }

        const totalPages = getTotalPages(registrationCount, pageSize);

        const returnRegistrations = registrations.map((r) => {
            const payment = paymentByUserId.get(r.userId);
            return {
                id: r.userId,
                image: r.user.image,
                name: r.user.name,
                ...(isEventAdmin
                    ? {
                          allowPhoto: r.allowPhoto,
                          status: r.status,
                          attendedAt: r.attendedAt?.toISOString() ?? null,
                          email: r.user.email,
                          registeredAt: r.createdAt.toISOString(),
                          waitlistPosition: r.waitlistPosition,
                          payment: payment
                              ? {
                                    id: payment.id,
                                    status: payment.status,
                                    amountMinor: payment.amountMinor,
                                    currency: payment.currency,
                                    expiresAt:
                                        payment.expiresAt?.toISOString() ??
                                        null,
                                    receivedPaymentAt:
                                        payment.receivedPaymentAt?.toISOString() ??
                                        null,
                                }
                              : null,
                      }
                    : {}),
            };
        });

        return c.json({
            totalCount: registrationCount,
            pages: totalPages,
            nextPage: page + 1 > totalPages ? null : page + 1,
            registeredUsers: returnRegistrations,
        } satisfies z.infer<typeof eventRegistrationListResponseSchema>);
    },
);
