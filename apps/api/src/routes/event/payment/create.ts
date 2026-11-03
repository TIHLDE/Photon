import { randomUUID } from "node:crypto";
import { type DbSchema, schema } from "@photon/db";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, isNull } from "drizzle-orm";
import { validator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import type { AppContext } from "~/lib/ctx";
import { describeRoute } from "~/lib/openapi";
import { route } from "~/lib/route";
import {
    buildPaymentDescription,
    cancelPayment,
    createPayment,
    getPaymentDetails,
} from "~/lib/vipps";
import { requireAuth } from "~/middleware/auth";
import {
    createPaymentBodySchema,
    createPaymentResponseSchema,
} from "../schema";

/** Worded like the checks before the Vipps call, which the event page translates. */
const ATTACH_REFUSALS = {
    spotGone: {
        status: 404,
        message: "You must register for the event before paying",
    },
    alreadyPaid: {
        status: 409,
        message: "The user has already paid for the event",
    },
    lostRace: {
        status: 409,
        message: "A pending payment already exists for this event",
    },
} as const;

const PAYMENT_ATTEMPT_LIMIT = 10;
const PAYMENT_ATTEMPT_WINDOW_SECONDS = 10 * 60;

/**
 * Fails open: a member with a running deadline must not lose their spot because
 * the counter could not be read.
 */
async function hasExceededPaymentAttempts(
    cache: AppContext["cache"],
    userId: string,
): Promise<boolean> {
    const key = `ratelimit:event-payment:${userId}`;

    try {
        const attempts = Number(await cache.getString(key)) || 0;
        if (attempts >= PAYMENT_ATTEMPT_LIMIT) return true;

        await cache.setString(
            key,
            String(attempts + 1),
            PAYMENT_ATTEMPT_WINDOW_SECONDS,
        );
        return false;
    } catch (error) {
        console.error("Could not read the payment attempt counter:", error);
        return false;
    }
}

/** The URL never left this request, and Vipps expires the session regardless. */
async function abandonCheckout(reference: string): Promise<void> {
    try {
        await cancelPayment(reference);
    } catch (error) {
        console.error(`Could not cancel unused checkout ${reference}:`, error);
    }
}

export const createPaymentRoute = route().post(
    "/:eventId/payment",
    describeRoute({
        tags: ["events", "payments"],
        summary: "Create payment for event",
        operationId: "createEventPayment",
        description:
            "Initiates a Vipps payment for an event registration. User must have a registered status for the event.",
    })
        .schemaResponse({
            statusCode: 201,
            schema: createPaymentResponseSchema,
            description: "Payment created successfully",
        })
        .badRequest({ description: "event not found or not a paid event" })
        .notFound({ description: "Event or registration not found" })
        .response({
            statusCode: 409,
            description: "Payment already exists for this user and event",
        })
        .response({
            statusCode: 429,
            description: "Too many payment attempts",
        })
        .build(),
    requireAuth,
    validator("json", createPaymentBodySchema),
    async (c) => {
        const eventId = c.req.param("eventId");
        const user = c.get("user");
        const userId = user.id;
        const body = c.req.valid("json");
        const { cache, db } = c.get("ctx");

        // Get event details
        const event = await db.query.event.findFirst({
            where: { id: eventId },
        });

        if (!event) {
            throw new HTTPException(404, { message: "Event not found" });
        }

        if (!event.isPaidEvent || !event.priceMinor) {
            throw new HTTPException(400, {
                message: "This event does not require payment",
            });
        }

        // Check that user has a registration with "registered" status
        const registration = await db.query.eventRegistration.findFirst({
            where: { eventId, userId },
        });

        if (!registration) {
            throw new HTTPException(404, {
                message: "You must register for the event before paying",
            });
        }

        if (registration.status !== "registered") {
            throw new HTTPException(400, {
                message: `Cannot create payment. Registration status is: ${registration.status}`,
            });
        }

        // Check for existing payments
        const existingPayments = await db.query.eventPayment.findMany({
            where: { eventId, userId },
        });

        // An unstarted obligation (created automatically on registration) is a
        // pending payment without a provider reference. Reuse it instead of
        // creating a duplicate — the countdown timer already tracks its id.
        let obligation = existingPayments.find(
            (p) => p.status === "pending" && !p.providerPaymentId,
        );

        // Check if already paid
        if (existingPayments.some((p) => p.status === "paid")) {
            throw new HTTPException(409, {
                message: "The user has already paid for the event",
            });
        }

        if (await hasExceededPaymentAttempts(cache, userId)) {
            throw new HTTPException(429, {
                message: "For mange betalingsforsøk. Vent litt og prøv igjen.",
            });
        }

        // A pending payment that has already been handed to Vipps is usually a
        // checkout the member walked away from — they pressed back in the
        // browser instead of paying — and it must not become a dead end. Ask
        // Vipps what actually happened to it: an unfinished checkout is
        // cancelled so this press gets a fresh one, and only a checkout that is
        // genuinely underway blocks a new attempt.
        const startedPayment = existingPayments.find(
            (p) => p.status === "pending" && p.providerPaymentId,
        );

        if (startedPayment?.providerPaymentId) {
            const reference = startedPayment.providerPaymentId;
            let details: Awaited<ReturnType<typeof getPaymentDetails>>;

            try {
                details = await getPaymentDetails(reference);
            } catch {
                // Without an answer from Vipps we cannot tell a paid checkout
                // from an abandoned one, so we keep the safe old behaviour.
                throw new HTTPException(409, {
                    message: "A pending payment already exists for this event",
                });
            }

            // Money has been reserved or drawn: the webhook settles this one,
            // and a second checkout would charge the member twice.
            if (
                details.state === "AUTHORIZED" ||
                details.aggregate.capturedAmount.value > 0 ||
                details.aggregate.authorizedAmount.value > 0
            ) {
                throw new HTTPException(409, {
                    message: "A pending payment already exists for this event",
                });
            }

            if (details.state === "CREATED") {
                try {
                    await cancelPayment(reference);
                } catch {
                    throw new HTTPException(409, {
                        message:
                            "A pending payment already exists for this event",
                    });
                }
            }

            // Nothing was paid, so the row is free to carry the new checkout —
            // and reusing it keeps the payment deadline the member already
            // sees counting down.
            obligation = startedPayment;
        }

        // Remaining states are either aborted or refunded. In that case they can create a new payment

        // Generate unique reference for Vipps
        const vippsReference = randomUUID();
        const priceMinor = event.priceMinor;

        const failedToInitiate = (error: unknown) =>
            new HTTPException(500, {
                message: `Failed to initiate Vipps payment: ${error instanceof Error ? error.message : "Unknown error"}`,
            });

        let checkoutUrl: string;
        try {
            checkoutUrl = await createPayment({
                amount: priceMinor,
                currency: "NOK",
                reference: vippsReference,
                userFlow: body.userFlow,
                returnUrl: body.returnUrl,
                description: buildPaymentDescription(event.title, user.name),
            });
        } catch (error) {
            throw failedToInitiate(error);
        }

        // A checkout is only payable once its URL leaves this request, so the
        // URL goes out only if this reference won the row. Two presses at once
        // would otherwise both get a URL, and money paid on the overwritten
        // reference would have no payment to land on.
        let outcome:
            | InferSelectModel<DbSchema["eventPayment"]>
            | keyof typeof ATTACH_REFUSALS;
        try {
            outcome = await db.transaction(async (tx) => {
                // Same lock order as the resolver: inserting a row takes this
                // lock anyway, and taking it after the spot could deadlock.
                if (!obligation) {
                    await tx
                        .select({ id: schema.event.id })
                        .from(schema.event)
                        .where(eq(schema.event.id, eventId))
                        .for("key share");
                }

                const [spot] = await tx
                    .select({ userId: schema.eventRegistration.userId })
                    .from(schema.eventRegistration)
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, eventId),
                            eq(schema.eventRegistration.userId, userId),
                            eq(schema.eventRegistration.status, "registered"),
                        ),
                    )
                    .for("update");

                if (!spot) return "spotGone";

                const current = await tx.query.eventPayment.findMany({
                    columns: { status: true },
                    where: {
                        eventId,
                        userId,
                        status: { in: ["pending", "paid"] },
                    },
                });

                if (current.some((p) => p.status === "paid")) {
                    return "alreadyPaid";
                }

                if (obligation) {
                    const [attached] = await tx
                        .update(schema.eventPayment)
                        .set({
                            provider: "vipps",
                            providerPaymentId: vippsReference,
                            amountMinor: priceMinor,
                            currency: "NOK",
                        })
                        .where(
                            and(
                                eq(schema.eventPayment.id, obligation.id),
                                eq(schema.eventPayment.status, "pending"),
                                obligation.providerPaymentId
                                    ? eq(
                                          schema.eventPayment.providerPaymentId,
                                          obligation.providerPaymentId,
                                      )
                                    : isNull(
                                          schema.eventPayment.providerPaymentId,
                                      ),
                            ),
                        )
                        .returning();

                    return attached ?? "lostRace";
                }

                if (current.length > 0) return "lostRace";

                const newPayment: InferInsertModel<DbSchema["eventPayment"]> = {
                    eventId,
                    userId,
                    amountMinor: priceMinor,
                    currency: "NOK",
                    provider: "vipps",
                    providerPaymentId: vippsReference,
                    status: "pending",
                };

                const [inserted] = await tx
                    .insert(schema.eventPayment)
                    .values(newPayment)
                    .returning();

                return inserted ?? "lostRace";
            });
        } catch (error) {
            await abandonCheckout(vippsReference);
            throw failedToInitiate(error);
        }

        if (typeof outcome === "string") {
            await abandonCheckout(vippsReference);
            const { status, message } = ATTACH_REFUSALS[outcome];
            throw new HTTPException(status, { message });
        }

        return c.json(
            {
                eventId: outcome.eventId,
                userId: outcome.userId,
                checkoutUrl,
                amount: priceMinor,
                currency: "NOK",
            },
            201,
        );
    },
);
