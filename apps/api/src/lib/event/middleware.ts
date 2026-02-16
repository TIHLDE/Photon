import type { OwnershipChecker } from "@photon/auth/server";
import { schema } from "@photon/db";
import { eq } from "drizzle-orm";

/**
 * Check if a user is the creator/owner of an event.
 */
export const isEventOwner: OwnershipChecker = async (ctx, eventId, userId) => {
    const event = await ctx.db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, eventId))
        .limit(1)
        .then((res) => res[0]);

    return event?.createdByUserId === userId;
};
