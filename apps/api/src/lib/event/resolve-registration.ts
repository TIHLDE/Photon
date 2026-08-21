import { schema } from "@photon/db";
import type { RegistrationStatus } from "@photon/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { env } from "../env";
import { createDeferredNotifications } from "../notification/deferred";
import { createPaymentObligations } from "./payment";
import {
    calculateWaitlistPositions,
    findSwapTarget,
    loadPrioritization,
} from "./priority";
import { canRegisterBasedOnStrikes, getStrikeCountsForUsers } from "./strikes";

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
        const batchUserIds = pendingRegistrations.map(
            (registration) => registration.userId,
        );

        const isUserPrioritizedForEvent = await loadPrioritization(
            batchUserIds,
            event,
            event.enforcesPreviousStrikes,
            tx,
        );

        /**
         * The strike counts for everyone in this batch, in one query rather
         * than one per member. Same reason the prioritisation above is hoisted:
         * a round trip per member is a round trip the whole sign-up waits on,
         * with the `FOR UPDATE` locks held the entire time.
         */
        const strikeCounts = await getStrikeCountsForUsers(batchUserIds, tx);

        /**
         * Who ends up holding a spot after this pass. Their status is written,
         * and their payment obligations handed out, in one statement each once
         * the loop is done — see below the loop.
         *
         * A `Set` and not a list: a member who takes a spot here can lose it
         * again later in the same pass, when a prioritised member swaps them
         * out. Writing the status as we went made that a race with itself.
         */
        const registeredUserIds = new Set<string>();

        // Step 4: Process each pending registration in order
        for (const registration of pendingRegistrations) {
            const { userId, createdAt } = registration;

            const strikeCount = strikeCounts.get(userId) ?? 0;

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
                    link: `${env.WEBSITE_URL}/arrangementer/${event.slug}`,
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

                    // They may have taken their spot earlier in this very pass,
                    // in which case the deferred write below must not put it
                    // back after this demotion.
                    registeredUserIds.delete(swapTarget.userId);

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

            /**
             * A spot is written once for everyone at the end of the pass; a
             * waitlist placement is written here and now, because the position
             * calculation just below reads the waitlist back out of the
             * database and has to see this member in it.
             */
            if (finalStatus === "registered") {
                registeredUserIds.add(userId);
            } else {
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
            }

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

            // Send notification to user based on finalStatus
            const eventUrl = `${env.WEBSITE_URL}/arrangementer/${event.slug}`;

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
                        const eventUrl = `${env.WEBSITE_URL}/arrangementer/${event.slug}`;
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

        /**
         * Every spot this pass handed out, written in one statement, and the
         * obligations that go with them in one more.
         *
         * The batch of 121 sign-ups that opened the immatrikuleringsball took
         * 5,5 seconds to resolve in production, ~70 ms per member — seven round
         * trips each, one member at a time, with the locks held throughout.
         * Nothing inside the loop reads a spot back out of the database, so
         * there is no reason to write them one by one.
         */
        if (registeredUserIds.size > 0) {
            const registeredIds = [...registeredUserIds];

            await tx
                .update(schema.eventRegistration)
                .set({ status: "registered", waitlistPosition: null })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, eventId),
                        inArray(schema.eventRegistration.userId, registeredIds),
                    ),
                );

            // Paid events only; the call is a no-op on a free one.
            await createPaymentObligations(txCtx, event, registeredIds);
        }
    });

    // Locks are released; now it is safe to spend time on the network.
    await notifications.flush(ctx);
}
