import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { and, eq } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { createDeferredNotifications } from "../notification/deferred";
import { createPaymentObligation } from "./payment";
import {
    calculateWaitlistPositions,
    findSwapTarget,
    loadPrioritization,
} from "./priority";
import { canRegisterBasedOnStrikes, getUserStrikeCount } from "./strikes";

/**
 * Resolve all pending registrations for an event
 *
 * This function:
 * 1. Fetches all pending registrations from database
 * 2. Processes them in timestamp order (FIFO) within a transaction
 * 3. Applies business rules (capacity, priority pools, strikes)
 * 4. Updates registration status in database
 */
export async function resolveRegistrationsForEvent(
    eventId: string,
    ctx: AppContext,
): Promise<void> {
    /**
     * Notifications decided inside the transaction and sent once it commits —
     * rendering an email template per affected member while holding the
     * `FOR UPDATE` locks below is time the whole event waits on.
     */
    const notifications = createDeferredNotifications();

    // Use database transaction to ensure atomic processing
    await ctx.db.transaction(async (tx) => {
        const txCtx = { ...ctx, db: tx };

        // Step 1: Fetch all pending registrations for this event with FOR UPDATE lock
        // This prevents concurrent processing of the same registrations
        const pendingRegistrations = await tx
            .select()
            .from(schema.eventRegistration)
            .where(
                and(
                    eq(schema.eventRegistration.eventId, eventId),
                    eq(schema.eventRegistration.status, "pending"),
                ),
            )
            .orderBy(schema.eventRegistration.createdAt) // FIFO
            .for("update"); // Lock these rows for the duration of the transaction

        if (pendingRegistrations.length === 0) {
            return; // No pending registrations
        }

        // Step 2: Fetch event with relations using transaction
        const event = await tx.query.event.findFirst({
            where: (event, { eq }) => eq(event.id, eventId),
            with: {
                registrations: {
                    where: (reg, { ne }) => ne(reg.status, "pending"),
                },
                pools: true,
                priorityUsers: true,
            },
        });

        if (!event) {
            throw new Error(`Event not found: ${eventId}`);
        }

        // Validate event is open for registration
        if (!event.requiresSigningUp || event.isRegistrationClosed) {
            // Cancel all pending registrations since event is not accepting registrations
            for (const registration of pendingRegistrations) {
                await tx
                    .update(schema.eventRegistration)
                    .set({ status: "cancelled" })
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, eventId),
                            eq(
                                schema.eventRegistration.userId,
                                registration.userId,
                            ),
                        ),
                    );
            }
            return;
        }

        // Step 3: Calculate initial capacity state
        const registeredCount = event.registrations.filter(
            (r) => r.status === "registered",
        ).length;

        const isUnlimitedCapacity = event.capacity === null;
        let availableSpots = isUnlimitedCapacity
            ? Number.POSITIVE_INFINITY
            : Math.max(0, (event.capacity ?? 0) - registeredCount);

        /**
         * Everyone in this batch, prioritized in two queries up front, rather
         * than two queries per member inside the loop below.
         */
        const isUserPrioritizedForEvent = await loadPrioritization(
            pendingRegistrations.map((registration) => registration.userId),
            event,
            event.enforcesPreviousStrikes,
            tx,
        );

        // Step 4: Process each pending registration in order
        for (const registration of pendingRegistrations) {
            const { userId, createdAt } = registration;

            const strikeCount = await getUserStrikeCount(userId, tx);

            // Check strike-based timing restriction
            const { allowed, reason } = canRegisterBasedOnStrikes(
                strikeCount,
                event.registrationStart,
                createdAt,
            );

            if (!allowed) {
                // User is blocked due to strike timing
                await tx
                    .update(schema.eventRegistration)
                    .set({ status: "cancelled" })
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, eventId),
                            eq(schema.eventRegistration.userId, userId),
                        ),
                    );

                // Send notification to user with reason
                notifications.add({
                    userId,
                    title: "Påmelding ikke godkjent",
                    description: `Din påmelding til ${event.title} ble ikke godkjent: ${reason}`,
                    link: `${env.ROOT_URL}/arrangementer/${event.slug}`,
                    emailTemplate: {
                        name: "RegistrationBlockedEmail",
                        props: {
                            eventName: event.title,
                            reason,
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    },
                });
                console.log(
                    `User ${userId} blocked from registration: ${reason}`,
                );
                continue;
            }

            // Determine if user is prioritized
            const isPrioritized = isUserPrioritizedForEvent(userId);

            // Determine final status
            let finalStatus: RegistrationStatus;
            let swappedUserId: string | null = null;

            if (isUnlimitedCapacity || availableSpots > 0) {
                // User gets a spot
                finalStatus = "registered";
                if (!isUnlimitedCapacity) {
                    availableSpots--;
                }
            } else if (isPrioritized) {
                // Try to swap with non-prioritized user
                const swapTarget = await findSwapTarget(
                    event.registrations,
                    event,
                    event.enforcesPreviousStrikes,
                    tx,
                );

                if (swapTarget) {
                    // Perform swap: demote swapTarget to waitlist
                    await tx
                        .update(schema.eventRegistration)
                        .set({
                            status: "waitlisted",
                            waitlistPosition: null, // Will be recalculated
                        })
                        .where(
                            and(
                                eq(schema.eventRegistration.eventId, eventId),
                                eq(
                                    schema.eventRegistration.userId,
                                    swapTarget.userId,
                                ),
                            ),
                        );

                    swappedUserId = swapTarget.userId;
                    finalStatus = "registered";

                    // A swapped-out member who had already paid keeps their
                    // payment. Refunding here would mean they had to pay again
                    // — and race a fresh deadline — if a spot frees up and they
                    // are promoted back in. Money that ends up owed is returned
                    // by an organiser instead; they are reminded at the event's
                    // start. See `notifyOrganizersOfPaymentsWithoutSpot`.

                    // Send notification to swapped user (will calculate position later)
                    console.log(
                        `User ${swapTarget.userId} swapped to waitlist by prioritized user ${userId}`,
                    );
                } else {
                    finalStatus = "waitlisted";
                }
            } else {
                finalStatus = "waitlisted";
            }

            // Update registration status in database first
            await tx
                .update(schema.eventRegistration)
                .set({
                    status: finalStatus,
                    waitlistPosition: null, // Will calculate after
                })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, eventId),
                        eq(schema.eventRegistration.userId, userId),
                    ),
                );

            // Calculate and update waitlist position if needed (after status is saved)
            let waitlistPosition: number | null = null;
            if (finalStatus === "waitlisted") {
                const positions = await calculateWaitlistPositions(
                    eventId,
                    event,
                    event.enforcesPreviousStrikes,
                    tx,
                );
                waitlistPosition = positions.get(userId) ?? null;

                await tx
                    .update(schema.eventRegistration)
                    .set({ waitlistPosition })
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, eventId),
                            eq(schema.eventRegistration.userId, userId),
                        ),
                    );
            }

            // For paid events, a registered user now owes payment: create the
            // obligation and schedule the countdown that reclaims the spot if
            // it is not paid within the grace period.
            if (finalStatus === "registered") {
                await createPaymentObligation(txCtx, event, userId);
            }

            // Send notification to user based on finalStatus
            const eventUrl = `${env.ROOT_URL}/arrangementer/${event.slug}`;

            if (finalStatus === "registered") {
                notifications.add({
                    userId,
                    title: `Du er påmeldt ${event.title}!`,
                    description: `Din påmelding til ${event.title} er bekreftet.`,
                    link: eventUrl,
                    emailTemplate: {
                        name: "RegistrationConfirmedEmail",
                        props: {
                            eventName: event.title,
                            eventUrl,
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    },
                });
            } else if (finalStatus === "waitlisted" && waitlistPosition) {
                notifications.add({
                    userId,
                    title: `Du er på venteliste for ${event.title}`,
                    description: `Du er nå på venteliste for ${event.title} (posisjon ${waitlistPosition}).`,
                    link: eventUrl,
                    emailTemplate: {
                        name: "WaitlistPlacementEmail",
                        props: {
                            eventName: event.title,
                            eventUrl,
                            position: waitlistPosition,
                            logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                        },
                    },
                });
            }

            console.log(
                `User ${userId} resolved to status: ${finalStatus}${waitlistPosition ? ` (position ${waitlistPosition})` : ""}`,
            );

            // Recalculate waitlist positions if:
            // 1. A swap occurred (non-prioritized user moved to waitlist)
            // 2. A prioritized user joined the waitlist (they jump ahead of non-prioritized)
            const shouldRecalculateWaitlist =
                swappedUserId ||
                (finalStatus === "waitlisted" && isPrioritized);

            if (shouldRecalculateWaitlist) {
                // One pass over the waitlist, not one pass per member of it.
                const positions = await calculateWaitlistPositions(
                    eventId,
                    event,
                    event.enforcesPreviousStrikes,
                    tx,
                );

                for (const [waitlistedUserId, newPosition] of positions) {
                    await tx
                        .update(schema.eventRegistration)
                        .set({ waitlistPosition: newPosition })
                        .where(
                            and(
                                eq(schema.eventRegistration.eventId, eventId),
                                eq(
                                    schema.eventRegistration.userId,
                                    waitlistedUserId,
                                ),
                            ),
                        );

                    // Send email to swapped user
                    if (waitlistedUserId === swappedUserId) {
                        const eventUrl = `${env.ROOT_URL}/arrangementer/${event.slug}`;
                        notifications.add({
                            userId: waitlistedUserId,
                            title: `Endring i din påmelding til ${event.title}`,
                            description: `Din påmelding til ${event.title} har blitt flyttet til venteliste (posisjon ${newPosition}).`,
                            link: eventUrl,
                            emailTemplate: {
                                name: "SwappedToWaitlistEmail",
                                props: {
                                    eventName: event.title,
                                    eventUrl,
                                    position: newPosition,
                                    logoUrl: `${env.WEBSITE_URL}/logo512.png`,
                                },
                            },
                        });
                    }
                }
            }

            // Update local event.registrations array for next iteration
            // This is needed so subsequent pending registrations see updated state
            if (finalStatus === "registered") {
                event.registrations.push({
                    eventId,
                    userId,
                    status: finalStatus,
                    waitlistPosition: null,
                    createdAt: registration.createdAt,
                    updatedAt: new Date(),
                    attendedAt: null,
                    allowPhoto: registration.allowPhoto,
                });
            }
            if (swappedUserId) {
                const swappedIndex = event.registrations.findIndex(
                    (r) => r.userId === swappedUserId,
                );
                if (swappedIndex !== -1) {
                    const existing = event.registrations[swappedIndex];
                    if (existing) {
                        event.registrations[swappedIndex] = {
                            eventId: existing.eventId,
                            userId: existing.userId,
                            status: "waitlisted",
                            waitlistPosition: null,
                            createdAt: existing.createdAt,
                            updatedAt: new Date(),
                            attendedAt: existing.attendedAt,
                            allowPhoto: existing.allowPhoto,
                        };
                    }
                }
            }
        }
    });

    // Locks are released; now it is safe to spend time on the network.
    await notifications.flush(ctx);
}
