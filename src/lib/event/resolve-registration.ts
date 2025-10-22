import { and, eq } from "drizzle-orm";
import { schema } from "../../db";
import type { RegistrationStatus } from "../../db/schema/event";
import type { AppContext } from "../ctx";
import { sendEmail } from "../email";
import { RegistrationBlockedEmail } from "../email/template/registration-blocked";
import { RegistrationConfirmedEmail } from "../email/template/registration-confirmed";
import { SwappedToWaitlistEmail } from "../email/template/swapped-to-waitlist";
import { WaitlistPlacementEmail } from "../email/template/waitlist-placement";
import { env } from "../env";
import {
    calculateWaitlistPosition,
    findSwapTarget,
    getUserGroupSlugs,
    isUserPrioritized,
} from "./priority";
import { canRegisterBasedOnStrikes, getUserStrikeCount } from "./strikes";

interface Props {
    userId: string;
    eventId: string;
}

export const registrationKey = ({ eventId, userId }: Props) =>
    `registration:${eventId}:${userId}`;

/**
 * Resolve all pending registrations for an event
 *
 * This function:
 * 1. Fetches all pending registrations from Redis
 * 2. Processes them in timestamp order (FIFO)
 * 3. Applies business rules (capacity, priority pools, strikes)
 * 4. Updates registration status in database
 * 5. Cleans up Redis keys
 */
export async function resolveRegistrationsForEvent(
    eventId: string,
    ctx: AppContext,
): Promise<void> {
    // Step 1: Fetch pending registrations from Redis
    const pendingKeys: Array<{
        userId: string;
        createdAtISO: string;
        key: string;
    }> = [];

    for await (const keys of ctx.redis.scanIterator({
        MATCH: `registration:${eventId}:*`,
    })) {
        for (const key of keys) {
            const createdAtISO = await ctx.redis.get(key);
            if (createdAtISO) {
                // Extract userId from key format: "registration:eventId:userId"
                const userId = key.split(":")[2];
                if (userId) {
                    pendingKeys.push({ userId, createdAtISO, key });
                }
            }
        }
    }

    // Sort by timestamp ASC (FIFO - first come, first served)
    pendingKeys.sort(
        (a, b) =>
            new Date(a.createdAtISO).getTime() -
            new Date(b.createdAtISO).getTime(),
    );

    if (pendingKeys.length === 0) {
        return; // Nothing to process
    }

    // Step 2: Fetch event with relations
    const event = await ctx.db.query.event.findFirst({
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
        // Clean up all pending keys since event is not accepting registrations
        for (const { key } of pendingKeys) {
            await ctx.redis.del(key);
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
    for (const { userId, createdAtISO, key } of pendingKeys) {
        // Fetch DB registration
        const dbRegistration = await ctx.db.query.eventRegistration.findFirst({
            where: (r, { and, eq }) =>
                and(
                    eq(r.eventId, eventId),
                    eq(r.userId, userId),
                    eq(r.status, "pending"),
                ),
        });

        // Cleanup orphaned Redis key
        if (!dbRegistration) {
            await ctx.redis.del(key);
            continue;
        }

        // Fetch user data in parallel
        const [userGroupSlugs, strikeCount] = await Promise.all([
            getUserGroupSlugs(userId, ctx.db),
            getUserStrikeCount(userId, ctx.db),
        ]);

        // Check strike-based timing restriction
        const { allowed, reason } = canRegisterBasedOnStrikes(
            strikeCount,
            event.registrationStart,
            new Date(createdAtISO),
        );

        if (!allowed) {
            // User is blocked due to strike timing
            await ctx.db
                .update(schema.eventRegistration)
                .set({ status: "cancelled" })
                .where(
                    and(
                        eq(schema.eventRegistration.eventId, eventId),
                        eq(schema.eventRegistration.userId, userId),
                    ),
                );
            await ctx.redis.del(key);

            // Send notification to user with reason
            const user = await ctx.db.query.user.findFirst({
                where: (user, { eq }) => eq(user.id, userId),
            });
            if (user) {
                await sendEmail({
                    to: user.email,
                    subject: "Påmelding ikke godkjent",
                    component: RegistrationBlockedEmail({
                        eventName: event.title,
                        reason,
                    }),
                });
            }
            console.log(`User ${userId} blocked from registration: ${reason}`);
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
                ctx.db,
            );

            if (swapTarget) {
                // Perform swap: demote swapTarget to waitlist
                await ctx.db
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
        await ctx.db
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
                ctx.db,
            );

            await ctx.db
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
        const user = await ctx.db.query.user.findFirst({
            where: (user, { eq }) => eq(user.id, userId),
        });

        if (user) {
            const eventUrl = `${env.ROOT_URL}/arrangementer/${event.slug}`;

            if (finalStatus === "registered") {
                await sendEmail({
                    to: user.email,
                    subject: `Du er påmeldt ${event.title}!`,
                    component: RegistrationConfirmedEmail({
                        eventName: event.title,
                        eventUrl,
                    }),
                });
            } else if (finalStatus === "waitlisted" && waitlistPosition) {
                await sendEmail({
                    to: user.email,
                    subject: `Du er på venteliste for ${event.title}`,
                    component: WaitlistPlacementEmail({
                        eventName: event.title,
                        eventUrl,
                        position: waitlistPosition,
                    }),
                });
            }
        }

        console.log(
            `User ${userId} resolved to status: ${finalStatus}${waitlistPosition ? ` (position ${waitlistPosition})` : ""}`,
        );

        // Cleanup Redis key
        await ctx.redis.del(key);

        // Recalculate waitlist positions if:
        // 1. A swap occurred (non-prioritized user moved to waitlist)
        // 2. A prioritized user joined the waitlist (they jump ahead of non-prioritized)
        const shouldRecalculateWaitlist =
            swappedUserId || (finalStatus === "waitlisted" && isPrioritized);

        if (shouldRecalculateWaitlist) {
            const waitlisted = await ctx.db.query.eventRegistration.findMany({
                where: (r, { and, eq }) =>
                    and(eq(r.eventId, eventId), eq(r.status, "waitlisted")),
            });

            for (const wReg of waitlisted) {
                const newPosition = await calculateWaitlistPosition(
                    wReg.userId,
                    eventId,
                    event.pools,
                    event.enforcesPreviousStrikes,
                    ctx.db,
                );
                await ctx.db
                    .update(schema.eventRegistration)
                    .set({ waitlistPosition: newPosition })
                    .where(
                        and(
                            eq(schema.eventRegistration.eventId, eventId),
                            eq(schema.eventRegistration.userId, wReg.userId),
                        ),
                    );

                // Send email to swapped user
                if (wReg.userId === swappedUserId && newPosition) {
                    const swappedUser = await ctx.db.query.user.findFirst({
                        where: (user, { eq }) => eq(user.id, wReg.userId),
                    });
                    if (swappedUser) {
                        const eventUrl = `${env.ROOT_URL}/arrangementer/${event.slug}`;
                        await sendEmail({
                            to: swappedUser.email,
                            subject: `Endring i din påmelding til ${event.title}`,
                            component: SwappedToWaitlistEmail({
                                eventName: event.title,
                                eventUrl,
                                position: newPosition,
                            }),
                        });
                    }
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
                createdAt: dbRegistration.createdAt,
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
}
