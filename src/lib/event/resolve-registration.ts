import { and, eq } from "drizzle-orm";
import { schema } from "../../db";
import type { RegistrationStatus } from "../../db/schema/event";
import type { AppContext } from "../ctx";
import { RegistrationBlockedEmail } from "../email/template/registration-blocked";
import { RegistrationConfirmedEmail } from "../email/template/registration-confirmed";
import { SwappedToWaitlistEmail } from "../email/template/swapped-to-waitlist";
import { WaitlistPlacementEmail } from "../email/template/waitlist-placement";
import { env } from "../env";
import { sendNotification } from "../notification";
import {
    calculateWaitlistPosition,
    findSwapTarget,
    getUserGroupSlugs,
    isUserPrioritized,
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
    // Use database transaction to ensure atomic processing
    await ctx.db.transaction(async (tx) => {
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
                pools: {
                    with: {
                        groups: true,
                    },
                },
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

        // Step 4: Process each pending registration in order
        for (const registration of pendingRegistrations) {
            const { userId, createdAt } = registration;

            // Fetch user data in parallel
            const [userGroupSlugs, strikeCount] = await Promise.all([
                getUserGroupSlugs(userId, tx),
                getUserStrikeCount(userId, tx),
            ]);

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
                await sendNotification(
                    {
                        userId,
                        title: "Påmelding ikke godkjent",
                        description: `Din påmelding til ${event.title} ble ikke godkjent: ${reason}`,
                        link: `${env.ROOT_URL}/arrangementer/${event.slug}`,
                        customEmailTemplate: RegistrationBlockedEmail({
                            eventName: event.title,
                            reason,
                        }),
                    },
                    ctx,
                );
                console.log(
                    `User ${userId} blocked from registration: ${reason}`,
                );
                continue;
            }

            // Determine if user is prioritized
            const isPrioritized = isUserPrioritized({
                userGroupSlugs,
                eventPools: event.pools,
                strikeCount,
                enforcesPreviousStrikes: event.enforcesPreviousStrikes,
            });

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
                    event.pools,
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

                    // Send notification to swapped user (will calculate position later)
                    // TODO: Check if swapped user had paid
                    // TODO: If paid, issue refund via payment processor
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
                waitlistPosition = await calculateWaitlistPosition(
                    userId,
                    eventId,
                    event.pools,
                    event.enforcesPreviousStrikes,
                    tx,
                );

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

            // TODO: If event isPaidEvent and finalStatus='registered':
            // TODO:   Create payment record with expiration = now + paymentGracePeriodMinutes
            // TODO:   Start payment countdown timer

            // Send notification to user based on finalStatus
            const eventUrl = `${env.ROOT_URL}/arrangementer/${event.slug}`;

            if (finalStatus === "registered") {
                await sendNotification(
                    {
                        userId,
                        title: `Du er påmeldt ${event.title}!`,
                        description: `Din påmelding til ${event.title} er bekreftet.`,
                        link: eventUrl,
                        customEmailTemplate: RegistrationConfirmedEmail({
                            eventName: event.title,
                            eventUrl,
                        }),
                    },
                    ctx,
                );
            } else if (finalStatus === "waitlisted" && waitlistPosition) {
                await sendNotification(
                    {
                        userId,
                        title: `Du er på venteliste for ${event.title}`,
                        description: `Du er nå på venteliste for ${event.title} (posisjon ${waitlistPosition}).`,
                        link: eventUrl,
                        customEmailTemplate: WaitlistPlacementEmail({
                            eventName: event.title,
                            eventUrl,
                            position: waitlistPosition,
                        }),
                    },
                    ctx,
                );
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
                const waitlisted = await tx.query.eventRegistration.findMany({
                    where: (r, { and, eq }) =>
                        and(eq(r.eventId, eventId), eq(r.status, "waitlisted")),
                });

                for (const wReg of waitlisted) {
                    const newPosition = await calculateWaitlistPosition(
                        wReg.userId,
                        eventId,
                        event.pools,
                        event.enforcesPreviousStrikes,
                        tx,
                    );
                    await tx
                        .update(schema.eventRegistration)
                        .set({ waitlistPosition: newPosition })
                        .where(
                            and(
                                eq(schema.eventRegistration.eventId, eventId),
                                eq(
                                    schema.eventRegistration.userId,
                                    wReg.userId,
                                ),
                            ),
                        );

                    // Send email to swapped user
                    if (wReg.userId === swappedUserId && newPosition) {
                        const eventUrl = `${env.ROOT_URL}/arrangementer/${event.slug}`;
                        await sendNotification(
                            {
                                userId: wReg.userId,
                                title: `Endring i din påmelding til ${event.title}`,
                                description: `Din påmelding til ${event.title} har blitt flyttet til venteliste (posisjon ${newPosition}).`,
                                link: eventUrl,
                                customEmailTemplate: SwappedToWaitlistEmail({
                                    eventName: event.title,
                                    eventUrl,
                                    position: newPosition,
                                }),
                            },
                            ctx,
                        );
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
                        };
                    }
                }
            }
        }
    });
}
